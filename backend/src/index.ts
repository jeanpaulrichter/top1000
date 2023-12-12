/*
This file is part of http://www.github.com/jeanpaulrichter/top1000
This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 3
of the License, or (at your option) any later version.
This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.
*/

import * as http from "http";
import * as express from "express";
import log from "./log";
import create_express from "express";
import create_session from "express-session";
import { join as joinPath } from "path";
import { Parser as Json2Csv } from '@json2csv/plainjs';
import { MongoDB } from "./db";
import { VoterGroups, StringValidation } from "./types";
import { AuthError, InputError, LoggedError } from "./exceptions";
import { validateFilterParams, validateString, validateInteger, validateGender } from "./validation";
import config from "./config";

/* ------------------------------------------------------------------------------------------------------------------------------------------ */

const app = create_express();
const db = new MongoDB(log.child({ module: "db" }));
const router = express.Router();

/* ------------------------------------------------------------------------------------------------------------------------------------------ */
// Main pages

router.get("/", (req: express.Request, res: express.Response) => {
    res.type("html").sendFile(joinPath(__dirname, "../html/list.html"));
});

router.get("/vote", (req: express.Request, res: express.Response) => {
    if(req.session.user === undefined) {
        res.redirect("/login");
    } else {
        res.type("html").sendFile(joinPath(__dirname, "../html/vote.html"));
    }
});

router.get("/login", (req: express.Request, res: express.Response) => {
    res.type("html").sendFile(joinPath(__dirname, "../html/login.html"));
})

router.get("/register", (req: express.Request, res: express.Response) => {
    res.type("html").sendFile(joinPath(__dirname, "../html/register.html"));
});

router.get("/password", (req: express.Request, res: express.Response) => {
    res.type("html").sendFile(joinPath(__dirname, "../html/password.html"));
});

router.get("/reset", (req: express.Request, res: express.Response) => {
    res.type("html").sendFile(joinPath(__dirname, "../html/reset.html"));
});

router.get("/image/:id", async(req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        if(typeof req.params.id !== "string" || req.params.id.length !== 24) {
            throw new InputError("Invalid id");
        }
        const buf = await db.getImage(req.params.id);
        if(buf.byteLength > 0) {
            res.set("Content-Type", "image/webp");
            res.end(buf, 'binary');
        } else {
            res.type("image/gif").sendFile(joinPath(__dirname, "../www/images/missing_screenshot.gif"));
        }
    } catch(exc) {
        next(exc);
    }
});

/* ------------------------------------------------------------------------------------------------------------------------------------------ */
// User account

router.post("/login", async(req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        if(req.session.user !== undefined) {
            throw new InputError("Already logged in");
        }

        // Validate input
        const email = validateString(req.body.email, "Invalid email", 1, 128, StringValidation.Email);
        const password = validateString(req.body.password, "Invalid password", 1, 128);
        const ip = validateString(req.ip, "Failed to read client IP", 7, 64);
        
        // Get user info
        req.session.user = await db.getUser(ip, email, password);

        res.send({ "error": false });
    } catch(exc) {
        next(exc);
    }
});

router.get("/logout", (req: express.Request, res: express.Response) => {
    req.session.destroy(() => {
        res.redirect("/");
    })
});

router.get("/validate", async(req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        // Validate input
        const token = validateString(req.query.token, "Invalid token", 8, 128);

        // Validate user
        await db.validateUser(token);

        res.redirect("/vote");
    } catch(exc) {
        next(exc);
    }
});

router.post("/register", async(req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        if(req.session.user !== undefined) {
            throw new InputError("Already logged in");
        }

        // Validate input
        const email = validateString(req.body.email, "Invalid email", 1, 128, StringValidation.Email);
        const password = validateString(req.body.password, "Invalid password", 1, 128);
        const ip = validateString(req.ip, "Failed to read client IP", 7, 64);

        // Create new user
        await db.addUser(ip, email, password);

        res.send({ "error": false });
    } catch(exc) {
        next(exc);
    }
});

router.post("/reset", async(req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        if(req.session.user !== undefined) {
            throw new InputError("Already logged in");
        }

        // Validate input
        const email = validateString(req.body.email, "Invalid email", 1, 128, StringValidation.Email);
        const ip = validateString(req.ip, "Failed to read client IP", 7, 64);

        // Reset user
        await db.resetUser(ip, email);

        res.send({ "error": false });
    } catch(exc) {
        next(exc);
    }
});

router.post("/password", async(req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        if(req.session.user !== undefined) {
            throw new InputError("Already logged in");
        }

        // Validate input
        const token = validateString(req.query.token, "Invalid token", 8, 128);
        const password = validateString(req.body.password, "Invalid password", 1, 128);

        // Set new password
        await db.setUserPassword(token, password);

        res.send({ "error": false });
    } catch(exc) {
        next(exc);
    }
});

/* ------------------------------------------------------------------------------------------------------------------------------------------ */
// API

/**
 * Add a game from mobygames.com to database
 * Expected POST params: moby_id
 */
router.post("/api/addgame", async(req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        if(req.session.user === undefined) {
            throw new AuthError();
        }
        
        // Validate input
        const moby_url = validateString(req.body.moby_url, "Invalid game url", 1, 256);
        const ip = validateString(req.ip, "Failed to read client IP", 7, 64);

        await db.addGame(ip, req.body.moby_url);

        res.send({
            "error": false
        });

    } catch(exc) {
        next(exc);
    }
});

/**
 * Change vote
 * Expected POST params: game, position
 */
router.post("/api/vote", async(req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        if(req.session.user === undefined) {
            throw new AuthError();
        }
        
        // Validate input (MongoDB ID as 24 byte string, position 1-100)
        const game_id = validateString(req.body.game, "Invalid game id", 24, 24);
        const position = validateInteger(req.body.position, "Invalid position", 1, 100);

        // Update database
        await db.updateVote(req.session.user, position, game_id);

        res.send({
            "error": false
        });
    } catch(exc) {
        next(exc);
    }
});

/**
 * Update user data
 * Expected POST params: gender, age ; optional: gamer, journalist, scientist, critic, wasted
 */
router.post("/api/user", async(req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        if(req.session.user === undefined) {
            throw new AuthError();
        }

        // Validate input        
        const gender = validateGender(req.body.gender, "Invalid gender");
        const age = validateInteger(req.body.age, "Invalid age", 0, 9);

        // User groups
        const groups: VoterGroups = {
            "gamer": (req.body.gamer === "gamer"),
            "journalist": (req.body.journalist === "journalist"),
            "scientist": (req.body.scientist === "scientist"),
            "critic": (req.body.critic === "critic"),
            "wasted": (req.body.wasted === "yes")
        };

        await db.updateUser({
            "id": req.session.user.id,
            "age": age,
            "gender": gender,
            "groups": groups
        });
        req.session.user.age = age;
        req.session.user.gender = gender;
        req.session.user.groups = groups;

        res.send({
            "error": false
        });

    } catch(exc) {
        next(exc);
    }
});

/**
 * Update comment for game
 * Expected POST params: position, comment
 */
router.post("/api/comment", async(req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        if(req.session.user === undefined) {
            throw new AuthError();
        }

        // Validate input
        const comment = validateString(req.body.comment, "Invalid comment", 1, 3000);
        const position = validateInteger(req.body.position, "Invalid position", 1, 100);

        await db.updateComment(req.session.user.id, position, comment);

        res.send({
            "error": false
        });

    } catch(exc) {
        next(exc);
    }
});

/**
 * Get information about user
 */
router.get("/api/user", async(req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        if(req.session.user === undefined) {
            throw new AuthError()
        }        
        res.send({
            "age": req.session.user.age,
            "gender": req.session.user.gender === undefined ? "" : req.session.user.gender,
            "gamer": req.session.user.groups.gamer,
            "journalist": req.session.user.groups.journalist,
            "scientist": req.session.user.groups.scientist,
            "critic": req.session.user.groups.critic,
            "wasted": req.session.user.groups.wasted
        });
    } catch(exc) {
        next(exc);
    }
});

/**
 * Get user votes
 */
router.get("/api/votes", async(req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        if(req.session.user === undefined) {
            throw new AuthError();
        }
        const votes = await db.getVotes(req.session.user.id);
        res.send(votes);
    } catch(exc) {
        next(exc);
    }
});

/**
 * Get top1000 list
 * GET params:
 *  page: [1-99999] (list page offset)
 *  gender: "female" | "male" | "other" (optional)
 *  age: [0-9] (optional)
 *  group: "gamer" | "journalist" | "scientist" | "critic" | "wasted" (optional)
*/
router.get("/api/list", async(req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        // Validate input
        const page = validateInteger(req.query.page, "Invalid page", 1, 99999);
        const options = validateFilterParams(req.query.gender, req.query.age, req.query.group);

        const data = await db.getList(page, 20, options);
        res.send(data);
    } catch(exc) {
        next(exc);
    }
});

/**
 * Get statistics about all votes
 *  gender: "female" | "male" | "other" (optional)
 *  age: [0-9] (optional)
 *  group: "gamer" | "journalist" | "scientist" | "critic" | "wasted" (optional)
 */
router.get("/api/statistics", async(req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        // Validate input
        const options = validateFilterParams(req.query.gender, req.query.age, req.query.group);

        const data = await db.getVoteStatistics(options);
        res.send(data);
    } catch(exc) {
        next(exc);
    }
});

/**
 * Search games database (for autocomplete)
 * GET params:
 *  term: searchterm
 *  page: results offset
 */
router.get("/api/search", async(req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        if(req.session.user === undefined) {
            throw new AuthError();
        }

        // Select2 will query with undefined searchterm first: send empty list
        if(req.query.search === undefined) {
            res.send([]);
        }

        // Validate input
        const page = validateInteger(req.query.page, "Invalid page", 1, 99999);
        const search = validateString(req.query.search, "Invalid search term", 1, 256);

        // Fetch and send result
        const result = await db.search(search, page);
        res.send(result);

    } catch(exc) {
        next(exc);
    }
});

/**
 * Get complete votes data
 * GET params:
 *  email: user email
 *  password: user password
 */
router.get("/api/data", async(req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        // Validate input
        const email = validateString(req.body.email, "Invalid email", 1, 128, StringValidation.Email);
        const password = validateString(req.body.password, "Invalid password", 1, 128);
        const ip = validateString(req.ip, "Failed to read client IP", 7, 64);

        // Get data
        const data = await db.getData(ip, email, password);

        // Convert to csv
        const parser = new Json2Csv({
            "header": true,
            "eol": "\n",
            "fields": ["user", "age", "gender", "wasted", "gamer", "journalist", "critic", "scientist", "position", "game", "year", "moby_id", "genres", "gameplay", "perspectives", "settings", "topics", "platforms"]
        });
        const csv = parser.parse(data);

        // Send as csv
        res.set("Content-Type", "text/csv; charset=utf-8");
        res.send(csv);

    } catch(exc) {
        next(exc);
    }
});

/**
 * Error handler
 */
router.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if(res.headersSent) {
        return next(err);
    }
    if(err instanceof InputError) {
        res.status(400).send(err.message);
    } else if(err instanceof AuthError) {
        res.status(401).send("Unauthorized request")
    } else {
        if(!(err instanceof LoggedError)) {
            log.error(err);
        }
        res.status(500).send("Internal error");
    }
});

/* ------------------------------------------------------------------------------------------------------------------------------------------ */

db.connect().then(() => {
    app.set("trust proxy", "loopback");
    // Set path of staticlly served files (css/javascript/images)
    app.use(express.static(joinPath(__dirname, "../www")));
    // Setup request parser
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());

    // Init mongoDB session store
    app.use(create_session({
        "store": db.getSessionStore(),
        "secret": "ajrgn35negkjndg",
        "resave": false,
        "saveUninitialized": false,
        "cookie": {
            "maxAge": 1000 * 60 * 60 * 24
        }
    }));

    // Mount router
    app.use(router);

    const server = http.createServer(app);
    server.on("error", err => {
        log.error(err);
    });
    server.listen(config.port, () => {
        const address = server.address();
        if(typeof address === "object" && address !== null) {
            log.info("Server started. Listening at port " + address.port);    
        } else {
            log.error("Failed to get server address");
        }
    });
}).catch(exc => {
    log.error(exc);
})
