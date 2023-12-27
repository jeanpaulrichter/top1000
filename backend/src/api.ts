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

import { Router, Request, Response, NextFunction } from "express";
import { Parser as Json2Csv } from '@json2csv/plainjs';
import { Logger } from "winston";
import { MongoDB } from "./db.js";
import { AuthError } from "./exceptions.js";
import { ConfigData } from "./config.js";
import { validateString, validateInteger, validateGender, validateFilterParams } from "./validate.js";
import { VoterGroups, UserInfo, StringValidation } from "./types.js";

/**
 * API express router
 */
export class APIRouter
{
    private log: Logger;
    private router: Router;
    private db: MongoDB;
    private config: ConfigData;

    constructor(db: MongoDB, log: Logger, config: ConfigData) {
        this.db = db;
        this.log = log;
        this.config = config;
        this.router = Router();

        this.router.post("/addgame", this.addgame.bind(this));
        this.router.post("/vote", this.vote.bind(this));
        this.router.post("/user", this.updateUser.bind(this));
        this.router.post("/comment", this.updateComment.bind(this));

        this.router.get("/user", this.getUserInfo.bind(this));
        this.router.get("/votes", this.getUserVotes.bind(this));
        this.router.get("/list", this.getList.bind(this));
        this.router.get("/statistics", this.getStatistics.bind(this));
        this.router.get("/search", this.searchDatabase.bind(this));
        this.router.get("/data", this.getData.bind(this));
    }

    /**
     * Return express router
     * @returns 
     */
    public get(): Router {
        return this.router;
    }

    /**
     * Add a game from mobygames.com to database
     * 
     * @param req Expected POST params (req.body): moby_ident [id or url]
     * 
     */
    private async addgame(req: Request, res: Response, next: NextFunction) {
        try {
            this.checkPermission(req);
            
            // Validate input
            const moby_ident = validateString(req.body.moby_ident, "Invalid mobygames id or url", 1, 256);
            const ip = validateString(req.ip, "Failed to read client IP", 7, 64);

            // Update database
            await this.db.addGame(ip, moby_ident);

            res.send({});
        } catch(exc) {
            next(exc);
        }
    }

    /**
     * Change user vote
     * 
     * @param req Expected POST params (req.body): game [id string], position [1-100]
     */
    private async vote(req: Request, res: Response, next: NextFunction) {
        try {
            const user = this.checkPermission(req);
            
            // Validate input
            const game_id = validateString(req.body.game, "Invalid game id", 24, 24);
            const position = validateInteger(req.body.position, "Invalid position", 1, 100);

            // Update database
            await this.db.updateVote(user, position, game_id);

            res.send({});
        } catch(exc) {
            next(exc);
        }
    }

    /**
     * Update user data
     * 
     * @param req Expected POST params (req.body): gender, age ; optional: gamer, journalist, scientist, critic, wasted
     */
    private async updateUser(req: Request, res: Response, next: NextFunction) {
        try {
            const user = this.checkPermission(req);

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

            // Update database
            await this.db.updateUser({
                "id": user.id,
                "age": age,
                "gender": gender,
                "groups": groups
            });

            // Update session object
            user.age = age;
            user.gender = gender;
            user.groups = groups;

            res.send({});
        } catch(exc) {
            next(exc);
        }
    }

    /**
     * Update user comment for game
     * 
     * @param req Expected POST params (req.body): position, comment
     */
    private async updateComment(req: Request, res: Response, next: NextFunction) {
        try {
            const user = this.checkPermission(req);

            // Validate input
            const comment = validateString(req.body.comment, "Invalid comment", 1, 3000, StringValidation.Comment);
            const position = validateInteger(req.body.position, "Invalid position", 1, 100);

            // Update database
            const new_comment = await this.db.updateComment(user.id, position, comment);

            res.send({
                "error": false,
                "comment": new_comment
            });
        } catch(exc) {
            next(exc);
        }
    }

    /**
     * Get information about currently logged in user
     */
    private async getUserInfo(req: Request, res: Response, next: NextFunction) {
        try {
            const user = this.checkPermission(req);

            // Send result from user session object
            res.send({
                "age": user.age,
                "gender": user.gender === undefined ? "" : user.gender,
                "gamer": user.groups.gamer,
                "journalist": user.groups.journalist,
                "scientist": user.groups.scientist,
                "critic": user.groups.critic,
                "wasted": user.groups.wasted
            });
        } catch(exc) {
            next(exc);
        }
    }

    /**
     * Get votes for currently logged in user
     */
    private async getUserVotes(req: Request, res: Response, next: NextFunction) {
        try {
            const user = this.checkPermission(req);

            // Fetch and send result
            const votes = await this.db.getVotes(user.id);
            res.send(votes);
        } catch(exc) {
            next(exc);
        }
    }

    /**
     * Get top1000 list
     * 
     * @param req GET params (req.query): page, gender, age, group
    */
    private async getList(req: Request, res: Response, next: NextFunction) {
        try {
            // Validate input
            const page = validateInteger(req.query.page, "Invalid page", 1, 99999);
            const options = validateFilterParams(req.query.gender, req.query.age, req.query.group);

            // Fetch and send result
            const data = await this.db.getList(page, this.config.games_per_page, options);
            res.send(data);
        } catch(exc) {
            next(exc);
        }
    }

    /**
     * Get statistics about all votes
     * 
     * @param req GET params (req.query): gender, age, group
     */
    private async getStatistics(req: Request, res: Response, next: NextFunction) {
        try {
            // Validate input
            const options = validateFilterParams(req.query.gender, req.query.age, req.query.group);

            // Fetch and send result
            const data = await this.db.getVoteStatistics(options);
            res.send(data);
        } catch(exc) {
            next(exc);
        }
    }

    /**
     * Search games database (for autocomplete)
     * 
     * @param req GET params (req.query): term, page
     */
    private async searchDatabase(req: Request, res: Response, next: NextFunction) {
        try {
            this.checkPermission(req);

            // Select2 will query with undefined searchterm first: send empty list
            if(req.query.search === undefined) {
                res.send([]);
            } else {
                // Validate input
                const page = validateInteger(req.query.page, "Invalid page", 1, 99999);
                const search = validateString(req.query.search, "Invalid search term", 1, 256);

                // Fetch and send result
                const result = await this.db.search(search, page);
                res.send(result);
            }
        } catch(exc) {
            next(exc);
        }
    }

    /**
     * Get complete votes data for currently logged in user
     */
    private async getData(req: Request, res: Response, next: NextFunction) {
        try {
            this.checkPermission(req);

            // Validate input
            const ip = validateString(req.ip, "Failed to read client IP", 7, 64);

            // Get data
            const data = await this.db.getData(ip);

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
    }

    /**
     * Check if client is logged in
     * 
     * @param req Express request
     * @return User info
     * @throws AuthError
     */
    private checkPermission(req: Request): UserInfo {
        if(req.session.user === undefined) {
            throw new AuthError();
        }
        return req.session.user;
    }
}
