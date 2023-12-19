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

import { createServer } from "http";
import { default as express, Request, Response, NextFunction } from "express";
import { default as session } from "express-session";
import { join } from "path";
import { fileURLToPath } from "url";
import { LoggerManager } from "./log.js";
import { ConfigFile } from "./config.js";
import { MongoDB } from "./db.js";
import { Mailer } from "./mail.js";
import { ImageDownloader } from "./images.js";
import { MobygamesLoader } from "./moby.js";
import { APIRouter } from "./api.js";
import { UserRouter } from "./user.js";
import { StaticRouter } from "./pages.js";
import { AuthError, InputError, LoggedError } from "./exceptions.js";

try {
    const app = express();
    const config = new ConfigFile("config.json");
    const logger = new LoggerManager(config);
    const log = logger.get();
    const mail = new Mailer(config);
    const images = new ImageDownloader(logger.getChild("images"));
    const moby = new MobygamesLoader(logger.getChild("moby"), config, images);
    const db = new MongoDB(logger.getChild("db"), config, mail, moby, images);
    const router_api = new APIRouter(db, logger.getChild("api"), config);
    const router_static = new StaticRouter(db, log);
    const router_user = new UserRouter(db, log);

    db.connect().then(() => {
        const production = (process.env.NODE_ENV === "production");

        if(production) {
            // Using reverse proxy in production
            app.enable("trust proxy");
        }

        const dirname = fileURLToPath(new URL('.', import.meta.url));

        // Set path of staticlly served files (css/javascript/images)
        app.use(express.static(join(dirname, "www")));

        // Setup request parser
        app.use(express.urlencoded({ extended: false }));
        app.use(express.json());

        // Init sessions
        app.use(session({
            "store": db.getSessionStore(),
            "secret": config.session.secret,
            "resave": false,
            "saveUninitialized": false,
            "cookie": {
                "maxAge": config.session.age,
                "secure": production
            }
        }));

        // Mount routers
        app.use("/user", router_user.get());
        app.use("/api", router_api.get());
        app.use("/", router_static.get());

        // Error handler
        app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
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
        const server = createServer(app);
        server.on("error", (err: Error) => {
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
    });

} catch(err) {
    if(err instanceof Error) {
        console.log(err.message);
    } else {
        console.log(err);
    }
}
