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

import * as express from "express";
import { Logger } from "winston";
import { MongoDB } from "./db.js";
import { InputError } from "./exceptions.js";
import { validateString } from "./validate.js";
import { StringValidation } from "./types.js";

/**
 * Express router for client actions (login, logout, etc)
 */
export class UserRouter
{
    private log: Logger;
    private router: express.Router;
    private db: MongoDB;

    constructor(db: MongoDB, log: Logger) {
        this.db = db;
        this.log = log;
        this.router = express.Router();

        this.router.post("/login", this.login.bind(this));
        this.router.post("/register", this.register.bind(this));
        this.router.post("/reset", this.resetPassword.bind(this));
        this.router.post("/password", this.setPassword.bind(this));

        this.router.get("/logout", this.logout.bind(this));
        this.router.get("/validate", this.validate.bind(this));
        this.router.get("/status", this.status.bind(this));
    }

    /**
     * Return express router object
     * @returns 
     */
    public get(): express.Router {
        return this.router;
    }

    /**
     * Login request
     * @param req Expected POST params (req.body): email, password
     */
    private async login(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            if(req.session.user !== undefined) {
                throw new InputError("Already logged in");
            }
    
            // Validate input
            const email = validateString(req.body.email, "Invalid email", 1, 128, StringValidation.Email);
            const password = validateString(req.body.password, "Invalid password", 8, 128);
            const ip = validateString(req.ip, "Failed to read client IP", 3, 64);
            
            // Fetch and send user info
            req.session.user = await this.db.getUser(ip, email, password);    
            res.send({});
        } catch(exc) {
            next(exc);
        }
    }

    /**
     * Status request
     */
    private status(req: express.Request, res: express.Response) {
        if(req.session.user !== undefined) {
            res.send({"login": true});
        } else {
            res.send({"login": false})
        }
    }
    
    /**
     * Logout request
     */
    private logout(req: express.Request, res: express.Response) {
        req.session.destroy(() => {
            res.redirect("/");
        });
    }
    
    /**
     * Validate user request
     * @param req Expected GET param (req.query): token
     */
    private async validate(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            // Validate input
            const token = validateString(req.query.token, "Invalid token", 4, 512);
    
            // Validate user
            await this.db.validateUser(token);
    
            res.redirect("/vote");
        } catch(exc) {
            next(exc);
        }
    }
    
    /**
     * Register new user request
     * @param req Expected POST params (req.body): email, password
     */
    private async register(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            if(req.session.user !== undefined) {
                throw new InputError("Already logged in");
            }
    
            // Validate input
            const email = validateString(req.body.email, "Invalid email", 1, 128, StringValidation.Email);
            const password = validateString(req.body.password, "Invalid Password", 8, 128);
            const ip = validateString(req.ip, "Failed to read client IP", 7, 64);
    
            // Create new user
            await this.db.addUser(ip, email, password);
    
            res.send({});
        } catch(exc) {
            next(exc);
        }
    }
    
    /**
     * Reset user password request
     * @param req Expected POST param (req.body): email
     */
    private async resetPassword(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            if(req.session.user !== undefined) {
                throw new InputError("Already logged in");
            }
    
            // Validate input
            const email = validateString(req.body.email, "Invalid email", 1, 128, StringValidation.Email);
            const ip = validateString(req.ip, "Failed to read client IP", 7, 64);
    
            // Reset user
            await this.db.resetUser(ip, email);
    
            res.send({});
        } catch(exc) {
            next(exc);
        }
    }
    
    /**
     * Set new user password request
     * @param req Expected POST params (req.body): token, password
     */
    private async setPassword(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            if(req.session.user !== undefined) {
                throw new InputError("Already logged in");
            }
    
            // Validate input
            const token = validateString(req.body.token, "Invalid token", 8, 256);
            const password = validateString(req.body.password, "Invalid password", 8, 128);
    
            // Set new password
            await this.db.setUserPassword(token, password);
    
            res.send({});
        } catch(exc) {
            next(exc);
        }
    }
}
