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

import { Router, Request, Response } from "express";
import { join } from "path";
import { fileURLToPath } from "url";
import { Logger } from "winston";
import { MongoDB } from "./db.js";
import { validateString } from "./validate.js";

/**
 * Express router that serves all html/image pages
 */
export class StaticRouter
{
    private log: Logger;
    private router: Router;
    private db: MongoDB;

    private html: {[key:string]:string} = {
        list: "list.html",
        login: "login.html",
        password: "password.html",
        register: "register.html",
        reset: "reset.html",
        vote: "vote.html"
    };

    private images:{[key:string]:string} = {
        missing: "nocover.webp"
    }

    constructor(db: MongoDB, log: Logger) {
        this.db = db;
        this.log = log;
        this.router = Router();

        const dirname = fileURLToPath(new URL('.', import.meta.url));

        // Append full path to html files
        for(const k in this.html) {
            this.html[k] = join(dirname, "html" , this.html[k]);
        }

        // Append full path to images files
        for(const k in this.images) {
            this.images[k] = join(dirname, "www/images" , this.images[k]);
        }
        
        // Bind pages to router
        this.router.get("/", this.list.bind(this));
        this.router.get("/vote", this.vote.bind(this));
        this.router.get("/login", this.login.bind(this));
        this.router.get("/register", this.register.bind(this));
        this.router.get("/password", this.password.bind(this));
        this.router.get("/reset", this.reset.bind(this));
        this.router.get("/image/:id", this.image.bind(this));
    }

    /**
     * Get express Router
     * @returns Router
     */
    public get(): Router {
        return this.router;
    }

    /**
     * Main list page
     */
    private list(req: Request, res: Response) {
        res.type("html").sendFile(this.html.list);
    }
    
    /**
     * Vote page (if user is logged in)
     */
    private vote(req: Request, res: Response) {
        if(req.session.user === undefined) {
            res.redirect("/login");
        } else {
            res.type("html").sendFile(this.html.vote);
        }
    }
    
    /**
     * Login page (if user is not logged in)
     */
    private login(req: Request, res: Response) {
        if(req.session.user !== undefined) {
            res.redirect("/");
        } else {
            res.type("html").sendFile(this.html.login);
        }
    }
    
    /**
     * Register page (if user is not logged in)
     */
    private register(req: Request, res: Response) {
        if(req.session.user !== undefined) {
            res.redirect("/");
        } else {
            res.type("html").sendFile(this.html.register);
        }
    }
    
    /**
     * Save new password page (if user is not logged in)
     */
    private password(req: Request, res: Response) {
        if(req.session.user !== undefined) {
            res.redirect("/");
        } else {
            res.type("html").sendFile(this.html.password);
        }
    }
    
    /**
     * Reset password page (if user is not logged in)
     */
    private reset(req: Request, res: Response) {
        if(req.session.user !== undefined) {
            res.redirect("/");
        } else {
            res.type("html").sendFile(this.html.reset);
        }
    }
    
    /**
     * Image from database
     */
    private image(req: Request, res: Response) {
        const image_id = validateString(req.params.id, "Invalid image id", 24, 24);

        this.db.getImage(image_id).then(image => {
            res.set("Content-Type", image.mime);
            res.end(image.data.buffer, 'binary');
        }).catch(() => {
            res.type("image/gif").sendFile(this.images.missing);
        });
    }
}
