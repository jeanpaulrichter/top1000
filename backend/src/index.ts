/*
This file is part of http://www.github.com/jeanpaulrichter/top1000
This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
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
import { scryptSync, randomBytes } from "crypto";
import { MongoDB } from "./db";
import { VoterGroups, Gender, VoterGroup } from "./types";
import { AuthError, InputError, LoggedError } from "./exceptions";
import { getGenderFromString, getVoterGroupFromString, sendVerificationEmail } from "./help";
import config from "./config";

// Create express app and database interface
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

/* ------------------------------------------------------------------------------------------------------------------------------------------ */
// User account

router.post("/login", async(req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        if(req.session.user !== undefined) {
            throw new InputError("Already logged in");
        }
        const email = req.body.email;
        const password = req.body.password;

        if(typeof email !== "string" || email.length == 0 || email.length > 128) {
            throw new InputError("Invalid email");
        }
        if(typeof password !== "string" || password.length == 0 || password.length > 128) {
            throw new InputError("Invalid password");
        }

        const user = await db.getUser(req.ip, email);
        const salt = Buffer.from(user.salt, "hex");
        const derivedKey = scryptSync(password, salt, 64);

        const test = derivedKey.toString("hex");
        if(test !== user.key) {
            log.info("Invalid login attempt by user " + user.id);
            throw new InputError("Invalid password");
        }

        req.session.user = {
            "id": user.id,
            "age": user.age,
            "gender": user.gender,
            "groups": user.groups
        };
        res.send({
            "error": false
        });
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
        if(typeof req.query.token !== "string" || req.query.token.length === 0 || req.query.token.length > 100) {
            throw new InputError("Missing token");
        }
        await db.validateUser(req.query.token);
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
        const email = req.body.email;
        const password = req.body.password;

        if(typeof email !== "string" || email.length == 0 || email.length > 128 || !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) {
            throw new InputError("Invalid email");
        }
        if(typeof password !== "string" || password.length < 8 || password.length > 128) {
            throw new InputError("Invalid password");
        }

        const salt = randomBytes(32);
        const derivedKey = scryptSync(password, salt, 64);
        const token = randomBytes(32).toString("hex");

        const userid = await db.addUser(req.ip, email, derivedKey.toString("hex"), salt.toString("hex"), token);
        try {
            await sendVerificationEmail(email, token);
        } catch(err) {
            await db.deleteUser(userid);
            throw err;
        }

        res.send({
            "error": false
        });
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
        
        // Validate game_id
        if(typeof req.body.moby_id !== "string" || req.body.moby_id.length === 0) {
            throw new InputError("Missing moby_id");
        }
        const moby_id = parseInt(req.body.moby_id);
        if(Number.isNaN(moby_id) || moby_id < 1 || moby_id > 9999999) {
            throw new InputError("Invalid moby_id");
        }

        await db.addGame(req.ip, moby_id);

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
        
        // Validate game id (MongoDB ID as 24 byte string)
        if(typeof req.body.game !== "string" || req.body.game.length !== 24) {
            throw new InputError("Invalid game");
        }
        // Validate position
        if(typeof req.body.position !== "string" || req.body.position.length === 0) {
            throw new InputError("Missing position");
        }
        const position = parseInt(req.body.position);
        if(Number.isNaN(position) || position < 1 || position > 100) {
            throw new InputError("Invalid position");
        }

        await db.updateVote(req.session.user, position, req.body.game);

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

        // Validate gender        
        if(typeof req.body.gender !== "string") {
            throw new InputError("Missing gender");
        }
        const gender = getGenderFromString(req.body.gender);

        // Validate age
        if(typeof req.body.age !== "string") {
            throw new InputError("Missing age");
        }
        const age = parseInt(req.body.age);
        if(Number.isNaN(age) || age < 0 || age > 9) {
            throw new InputError("Invalid age");
        }

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
        // Validate comment
        if(typeof req.body.comment !== "string" || req.body.comment.length === 0 || req.body.comment.length > 6000) {
            throw new InputError("Invalid comment");
        }
        const comment = req.body.comment;

        // Validate position
        if(typeof req.body.position !== "string" || req.body.position.length === 0) {
            throw new InputError("Missing position");
        }
        const position = parseInt(req.body.position);
        if(Number.isNaN(position) || position < 1 || position > 100) {
            throw new InputError("Invalid position");
        }

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
        // Validate page
        if(typeof req.query.page !== "string") {
            throw new InputError("Missing page");
        }
        const page = parseInt(req.query.page);
        if(Number.isNaN(page) || page < 1 || page > 99999) {
            throw new InputError("Invalid page");
        }

        // Validate gender
        let gender: Gender | undefined = undefined;
        if(typeof req.query.gender === "string") {
            gender = getGenderFromString(req.query.gender);
            if(gender === undefined) {
                throw new InputError("Invalid gender");
            }
        }

        // Validate age
        let age: number | undefined = undefined;
        if(typeof req.query.age === "string") {
            age = parseInt(req.query.age);
            if(Number.isNaN(age) || age < 1 || age > 9) {
                throw new InputError("Invalid age");
            }
        }

        // Validate group
        let group: VoterGroup | undefined = undefined;
        if(typeof req.query.group === "string") {
            group = getVoterGroupFromString(req.query.group);
            if(group === undefined) {
                throw new InputError("Invalid group");
            }
        }

        const data = await db.getList(page, gender, age, group);
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
        // Validate page
        let page = 1;
        if(typeof req.query.page === "string") {
            const tpage = parseInt(req.query.page);
            if(!(Number.isNaN(page) || page < 1 || page > 99999)) {
                page = tpage;
            }
        }

        // Validate searchterm
        const term = (typeof req.query.search === "string") ? req.query.search : "";
        if(term.length === 0 ) {
            res.send([]);
        } else {
            const result = await db.search(term, page);
            res.send(result);
        }
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

// Start server
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
    server.on('error', err => {
        console.error(err);
    });
    server.listen(config.port, () => {
        const address = server.address();
        if(typeof address === "object" && address !== null) {
            console.log("Server started. Listening at port " + address.port);    
        } else {
            console.log("Failed to get server address");
        }
    });
}).catch(exc => {
    console.error(exc);
})
