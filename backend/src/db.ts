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

import { createHash, scryptSync } from "crypto";
import MongoStore from "connect-mongo";
import { Store as SessionStore } from "express-session";
import { Logger } from "winston";
import { MongoClient, ReadPreference, Collection, MongoClientOptions, ObjectId, Document, TransactionOptions } from "mongodb";
import { Gender, VoteGame, VoterGroup, User, UserInfo } from "./types";
import { InputError, LoggedError } from "./exceptions";
import { getMobygamesInfo, getMobyIDFromURL } from "./help";
import config from "./config";

/**
 * MongoDB interface class
 */
export class MongoDB
{
    private client: MongoClient | undefined;
    private games: Collection | undefined;
    private votes: Collection | undefined;
    private users: Collection | undefined;
    private ipblock: Collection | undefined;
    private log: Logger;

    constructor(log: Logger) {
        this.log = log;
    }

    /**
     * Connect to MongoDB server
     * @throws LoggedError
     */
    public async connect(): Promise<void> {
        try {
            this.client = await MongoClient.connect(config.mongodb, {
                "useUnifiedTopology": true,
                "appname": "Top1000",
                "readPreference": ReadPreference.PRIMARY_PREFERRED,
                "connectTimeoutMS": 2000
            } as MongoClientOptions);

            // Select database
            const db = this.client.db(config.database);
            await db.command({ ping: 1 });

            // Get collections
            this.games = db.collection("games");
            this.votes = db.collection("votes");
            this.users = db.collection("users");
            this.ipblock = db.collection("ipblock");

            this.log.info("Connected to mongodb server");
        } catch(err) {
            await this.close();
            this.log.error(err);
            this.log.error("Failed to connect to " + config.mongodb);
            throw new LoggedError();
        }
    }

    /**
     * Close database connection
     */
    public async close(): Promise<void> {
        if(this.client !== undefined) {
            await this.client.close();
            this.client = undefined;
        }
    }

    /**
     * Get sessionstore for express server
     * @returns SessionStore
     * @throws LoggedError
     */
    public getSessionStore(): SessionStore {
        if(this.client === undefined) {
            this.log.error("No database connection");
            throw new LoggedError();
        } else {
            return MongoStore.create({
                "client": this.client,
                "dbName": "top1000",
                "crypto": {
                    "secret": "ahj4hj56judghja1m"
                }
            });
        }
    }

    /**
     * Get User by email adress
     * 
     * @param email - Email to query
     * @return Userdata
     * @throws InputError, LoggedError
     */
    public async getUser(ip: string, email: string): Promise<User> {
        try {
            if(this.users === undefined || this.ipblock === undefined) {
                throw new Error("No database connection");
            }
            await this.ipBlockCheck(ip, "login", 10, 15);

            const email_hash = createHash("sha256").update(email).digest("hex");

            const ret = await this.users.findOne<User>({
                "email": email_hash,
                "token": { "$exists": false }
            }, {
                "projection": {
                    "_id": 0,
                    "id": { $toString: "$_id" },
                    "salt": 1, "key": 1, "gender": 1, "age": 1, "groups": 1
                }
            });
            if(ret === null) {
                throw new InputError("User not found");
            }
            return ret;
        } catch(exc) {
            if(exc instanceof InputError) {
                throw exc;
            }
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /**
     * Add new user to database
     * @param ip Client IP
     * @param email Email address of new user
     * @param key Hex string of key
     * @param salt Hex string of salt
     * @param token Token string
     * @returns User id
     * @throws InputError, LoggedError
     */
    public async addUser(ip: string, email: string, key: string, salt: string, token: string): Promise<string> {
        try {
            if(this.users === undefined || this.ipblock === undefined) {
                throw new Error("No database connection");
            }
            await this.ipBlockCheck(ip, "register", 1, 30);

            const email_hash = createHash("sha256").update(email).digest("hex");

            const check = await this.users.findOne({
                "email": email_hash
            });
            if(check !== null) {
                throw new InputError("Email already exits.")
            }

            const ret = await this.users.insertOne({
                "email": email_hash,
                "key": key,
                "salt": salt,
                "gender": "",
                "age": 0,
                "groups": {
                    "gamer": false,
                    "journalist": false,
                    "scientist": false,
                    "critic": false,
                    "wasted": false
                },
                "creation_date": new Date(),
                "token": token
            });
            if(!ret.acknowledged) {
                throw new Error("Failed to insert new user into database");
            }
            return ret.insertedId.toHexString();
        } catch(exc) {
            if(exc instanceof InputError || exc instanceof LoggedError) {
                throw exc;
            }
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /**
     * Delete user from database
     * @param id User id
     * @throws LoggedError
     */
    public async deleteUser(id: string): Promise<void> {
        try {
            if(this.users === undefined || this.votes === undefined) {
                throw new Error("No database connection");
            }
            const user_id = ObjectId.createFromHexString(id);
            const ret = await this.users.deleteOne({
                "_id": user_id
            });
            if(ret.deletedCount !== 1) {
                throw new Error("Failed to delete user");
            }
            await this.votes.deleteMany({
                "user": user_id
            });
        } catch(exc) {
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /**
     * Validate new user
     * @param token Token string
     * @throws LoggedError
     */
    public async validateUser(token: string): Promise<void> {
        try {
            if(this.users === undefined) {
                throw new Error("No database connection");
            }
            await this.users.updateOne({
                "token": token
            }, {
                "$unset": {
                    "token": ""
                }
            });
        } catch(exc) {
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /**
     * Add game to database
     * @param ip Client IP
     * @param moby_url Mobygames game URL
     * @throws InputError, LoggedError
     */
    public async addGame(ip: string, moby_url: string): Promise<void> {
        try {
            if(this.games === undefined) {
                throw new Error("No database connection");
            }
            // Check if user has added too many games already
            await this.ipBlockCheck(ip, "addgame", 5, 10);

            const moby_id = await getMobyIDFromURL(moby_url);

            // Check if game is already in database
            const test = await this.games.findOne({
                "moby_id": moby_id
            }, {
                "projection": { "_id": 1 }
            });
            if(test !== null) {
                throw new InputError("Game already in database");
            }

            // Get data from mobygames.com
            const game = await getMobygamesInfo(moby_id);

            // Insert game into database
            const ret = await this.games.insertOne(game);
            if(!ret.acknowledged) {
                throw new Error("Failed to insert game into database");
            }
            this.log.info("Added game \"" + game.title + "\" with moby_id " + game.moby_id + ".");
        } catch(exc) {
            if(exc instanceof InputError || exc instanceof LoggedError) {
                throw exc;
            }
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /**
     * Update vote of user
     * @param user UserInfo
     * @param position Game rank/position
     * @param game_id Game ID in database
     * @throws LoggedError
     */
    public async updateVote(user: UserInfo, position: number, game_id: string): Promise<void> {
        try {
            if(this.votes === undefined || this.games === undefined) {
                throw new Error("No database connection");
            }
            if(user.id.length !== 24) {
                throw new Error("Invalid user id");
            }
            if(game_id.length !== 24) {
                throw new Error("Invalid game id");
            }
            if(!(Number.isInteger(position) && position > 0 && position <= 100)) {
                throw new Error("Invalid position");
            }
            const game_object_id = ObjectId.createFromHexString(game_id);
            const game = await this.games.findOne({
                "_id": game_object_id
            }, {
                "projection": {
                    "title": 1,
                    "moby_id": 1,
                    "year": 1
                }
            });
            if(game === null) {
                throw new InputError("Game not found");
            }
            const ret = await this.votes.updateOne({
                "user_id": ObjectId.createFromHexString(user.id),
                "position": position,
                "age": user.age,
                "gender": user.gender,
                "groups": user.groups
            }, { "$set": {
                "game_id": game_object_id,
                "game_title": game.title,
                "game_year": game.year,
                "game_moby_id": game.moby_id
            } }, {
                "upsert": true
            });

            if(ret.modifiedCount !== 1 && ret.upsertedCount !== 1) {
                throw new Error("Failed to update database");
            }
        } catch(exc) {
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /**
     * Update comment for game by user
     * @param user_id UserID
     * @param position Position/rank of game
     * @param comment Comment string
     * @throws LoggedError
     */
    public async updateComment(user_id: string, position: number, comment: string): Promise<void> {
        try {
            if(this.votes === undefined) {
                throw new Error("No database connection");
            }
            if(user_id.length !== 24) {
                throw new Error("Invalid user id");
            }
            if(!(Number.isInteger(position) && position > 0 && position <= 100)) {
                throw new Error("Invalid position");
            }
            const ret = await this.votes.updateOne({
                "user_id": ObjectId.createFromHexString(user_id),
                "position": position
            }, { "$set": {
                "comment": comment
            } });

            if(!(ret.acknowledged && ret.matchedCount === 1)) {
                throw new Error("Failed to update database");
            }
        } catch(exc) {
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /**
     * Update user information
     * @param user UserInfo
     * @throws LoggedError
     */
    public async updateUser(user: UserInfo): Promise<void> {
        try {
            if(this.votes === undefined || this.users === undefined || this.client === undefined) {
                throw new Error("No database connection");
            }
            if(user.id.length !== 24) {
                throw new Error("Invalid user id");
            }
            const user_id = ObjectId.createFromHexString(user.id);

            const session = this.client.startSession();
            const transactionOptions: TransactionOptions = {
                "readPreference": ReadPreference.primaryPreferred,    
                "readConcern": { level: "local" },    
                "writeConcern": { w: "majority" }    
            };

            try {
                session.startTransaction(transactionOptions);
                // Update all user votes
                let ret = await this.votes.updateMany({
                    "user_id": user_id,
                }, { "$set": {
                    "age": user.age,
                    "gender": user.gender,
                    "groups": user.groups
                } }, {
                    "session": session
                });

                // Update user
                ret = await this.users.updateOne({
                    "_id": user_id
                }, { "$set": {
                    "age": user.age,
                    "gender": user.gender,
                    "groups": user.groups
                } }, {
                    "session": session
                });

                if(ret.matchedCount !== 1) {
                    throw new Error("Failed to update user");
                }
                await session.commitTransaction();
            } catch(exc) {
                await session.abortTransaction();
                throw exc;
            } finally {
                await session.endSession();
            }
        } catch(exc) {
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /**
     * Get votes of user
     * @param user_id User id
     * @returns Array of vote info
     * @throws LoggedError
     */
    public async getVotes(user_id: string): Promise<VoteGame[]> {
        try {
            if(this.votes === undefined) {
                throw new Error("No database connection");
            }
            if(user_id.length !== 24) {
                throw new Error("Invalid user id");
            }

            const ret = await this.votes.aggregate([
                { "$match": {
                    "user_id": ObjectId.createFromHexString(user_id)
                } },
                { "$lookup": {
                    "from": "games",
                    "localField": "game_id",
                    "foreignField": "_id",
                    "as": "info"
                } },
                { "$project": {
                    _id: 0,
                    position: "$position",
                    comment: "$comment",
                    id: { "$toString" : "$game_id" },
                    title: { "$arrayElemAt": [ "$info.title", 0 ] },
                    year: { "$arrayElemAt": [ "$info.year", 0 ] },
                    platforms: { "$arrayElemAt": [ "$info.platforms", 0 ] },
                    icon: { "$arrayElemAt": [ "$info.icon", 0 ] },
                } }
            ]).toArray();
            return ret as VoteGame[];
        } catch(exc) {
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /**
     * Get the whole votes collection
     * @returns Array of votes
     * @throws InputError, LoggedError
     */
     public async getData(ip: string, email: string, password: string) {
        try {
            if(this.votes === undefined || this.users === undefined) {
                throw new Error("No database connection");
            }
            await this.ipBlockCheck(ip, "data", 10, 15);

            const email_hash = createHash("sha256").update(email).digest("hex");
            const user = await this.users.findOne({
                "email": email_hash,
                "token": { "$exists": false }
            }, {
                "projection": {
                    "_id": 0,
                    "salt": 1,
                    "key": 1
                }
            });
            if(user === null) {
                throw new InputError("User not found");
            }
            const salt = Buffer.from(user.salt, "hex");
            const test = scryptSync(password, salt, 64).toString("hex");
            if(test !== user.key) {
                throw new InputError("Invalid password");
            }

            const ret = await this.votes.find({}, {
                "projection": {
                    "_id": 0,
                    "user": { "$toString": "$user_id" },
                    "age": 1,
                    "gender": 1,
                    "wasted": "$groups.wasted",
                    "gamer": "$groups.gamer",
                    "journalist": "$groups.journalist",
                    "critic": "$groups.critic",
                    "scientist": "$groups.scientist",
                    "game": "$game_title",
                    "year": "$game_year",
                    "moby_id": "$game_moby_id",
                    "position": 1
                }
            }).toArray();
            return ret;
        } catch(exc) {
            if(exc instanceof InputError) {
                throw exc;
            }
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /**
     * Get top1000 list data
     * @param page Page offset [1-99999]
     * @param gender Gender (optional)
     * @param age Age group (optional)
     * @param group Voter group (optional)
     * @returns List data
     * @throws InputError, LoggedError
     */
    public async getList(page: number, gender?: Gender, age?: number, group?: VoterGroup) {
        try {
            if(this.votes === undefined) {
                throw new Error("No database connection");
            }
            if(!(Number.isInteger(page) && page > 0 && page < 99999)) {
                throw new InputError("Invalid page");
            }
            const query: Document = {};
            if(gender !== undefined) {
                query.gender = gender.toString();
            }
            if(age !== undefined) {
                query.age = age;
            }
            if(group !== undefined) {
                query["groups." + group.toString()] = true;
            }
            const ret = await this.votes.aggregate([
                { "$match": query },
                { "$group": {
                    "_id": "$game_id",
                    "rank": { "$sum": { "$subtract": [10.3103448275862, { "$multiply": [0.3103448275862, "$position"]}] } },
                    "comments": { "$push": "$comment" },
                    "votes" : { "$sum": 1 }
                } },
                { "$facet": {
                    "meta": [ { "$count": "total" } ],
                    "data": [
                        { "$sort": {
                            "rank": -1
                        }},
                        { "$skip": (page - 1) * 20 },
                        { "$limit": 20 },
                        { "$lookup": {
                            "from": "games",
                            "localField": "_id",
                            "foreignField": "_id",
                            "as": "game"
                        } },
                        { "$project": {
                            "rank": "$rank",
                            "votes": "$votes",
                            "game": { "$arrayElemAt": [ "$game", 0 ] },
                            "comments": "$comments"
                        } }
                    ]
                } }
            ]).next();

            if(ret === null) {
                throw new Error("Failed to get list");
            }

            // Get count of all matching games
            const count = (Array.isArray(ret.meta) && ret.meta.length === 1 && typeof ret.meta[0].total === "number") ? ret.meta[0].total : 0;

            return {
                "data": ret.data,
                "pages": Math.ceil(count / 20),
                "limit": 20
            };
        } catch(exc) {
            if(exc instanceof InputError) {
                throw exc;
            }
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /**
     * Search games database (Used for autocomplete)
     * @param input Search term (game title)
     * @param page integer page offset (optional)
     * @returns Search results
     * @throws LoggedError
     */
    public async search(input: string, page?: number) {
        try {
            if(this.games === undefined) {
                throw new Error("No database connection");
            }

            const regex_escape = /[.*+?^${}()|[\]\\]/g;

            // Get offset
            let offset = 0;
            if(page !== undefined && Number.isInteger(page) && page > 0 && page < 100000) {
                offset = (page - 1) * 10;
            }

            const res = await this.games.aggregate([
                { "$match": {
                    "title": new RegExp(input.replace(regex_escape, "\\$&"),"gi")
                } },
                { "$sort": { "title": 1 } },
                { "$facet": {
                    "metadata": [ { "$count": "total" } ],
                    "data": [
                        { "$skip": offset },
                        { "$limit": 20 },
                        { "$project": {
                            "_id": 0,
                            "id": { "$toString": "$_id" },
                            "title": "$title",
                            "year": "$year",
                            "icon": "$icon",
                            "platforms": "$platforms"
                        } }
                    ]
                } }
            ]).next();

            if(res !== null && res.data.length > 0) {
                return {
                    "results": res.data,
                    "pagination": {
                        "more": res.metadata[0].total > offset + 10
                    }
                }
            } else {
                return {
                    "results": [],
                    "pagination": {
                        "more": false
                    }
                }
            }
        } catch(exc) {
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /**
     * Check if client is allowed to do something
     * @param ip Client IP
     * @param action Action string (login|register|addgame)
     * @param max Maximum tries
     * @param minutes in x minutes
     * @throws InputError, LoggedError
     */
    private async ipBlockCheck(ip: string, action: string, max: number, minutes: number) {
        try {
            if(this.ipblock === undefined) {
                throw new Error("No database connection");
            }
            // Discard old enough records
            await this.ipblock.deleteMany({
                "action": action,
                "timestamp": {
                    $lte: new Date(Date.now() - 1000 * 60 * minutes)
                }
            });

            // Check if client is blocked
            const ip_check = await this.ipblock.findOne({
                "ip": ip,
                "action": action,
                "count": { "$gte": max }
            });
            if(ip_check !== null) {
                throw new InputError(`Only ${max} tries in ${minutes} minutes permitted.`);
            }

            // Update record
            await this.ipblock.updateOne({
                "ip": ip,
                "action": action
            }, {
                "$set": { "timestamp": new Date() },
                "$inc": { "count": 1 }
            }, {
                "upsert": true
            });
        } catch(exc) {
            if(exc instanceof InputError) {
                throw exc;
            }
            this.log.error(exc);
            throw new LoggedError();
        }
    }
}