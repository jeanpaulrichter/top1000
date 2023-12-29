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

import { ResizeOptions, default as sharp } from "sharp";
import { createHash, scryptSync, randomBytes } from "crypto";
import { default as MongoStore } from "connect-mongo";
import { Store as SessionStore } from "express-session";
import { Logger } from "winston";
import { MongoClient, ReadPreference, Collection, MongoClientOptions, ObjectId, Document, ClientSession } from "mongodb";
import { VoteGame, User, UserInfo, ClientAction, VoteStatistics, FilterOptions, ImageBuffer } from "./types.js";
import { InputError, LoggedError } from "./exceptions.js";
import { MobygamesLoader } from "./moby.js";
import { Mailer } from "./mail.js";
import { ImageDownloader } from "./images.js";
import { ConfigData } from "./config.js";

/**
 * MongoDB interface class
 */
export class MongoDB
{
    private client?: MongoClient;
    private client_images?: MongoClient;
    private log: Logger;
    private config: ConfigData;
    private moby: MobygamesLoader;
    private mail: Mailer;
    private images: ImageDownloader;
    private collections: {[key: string]: Collection} = {};

    constructor(log: Logger, config: ConfigData, mail: Mailer, moby: MobygamesLoader, images: ImageDownloader) {
        this.log = log;
        this.config = config;
        this.mail = mail;
        this.images = images;
        this.moby = moby;
    }

    /**
     * Connect to MongoDB server
     * @throws LoggedError
     */
    public async connect(): Promise<void> {
        try {
            const options: MongoClientOptions = {
                "readPreference": ReadPreference.PRIMARY_PREFERRED,
                "connectTimeoutMS": 2000,
                "appName": "Top1000"
            };

            this.log.info("Connecting to database ...");
            this.client = await MongoClient.connect(this.config.mongodb.uri, options);

            // Select database
            const db = this.client.db(this.config.mongodb.database);
            await db.command({ ping: 1 });
            this.log.info("Connected to database");

            if(this.config.mongodb_images) {
                this.log.info("Connecting to images database ...");
                this.client_images = await MongoClient.connect(this.config.mongodb_images.uri, options);
    
                // Select database
                const db_images = this.client_images.db(this.config.mongodb_images.database);
                await db_images.command({ ping: 1 });
                this.log.info("Connected to images database");

                this.collections.images = db_images.collection("images");
            }

            // Get collections
            this.collections.games = db.collection("games");
            this.collections.votes = db.collection("votes");
            this.collections.users = db.collection("users");
            this.collections.ipblock = db.collection("ipblock");

            if(!this.config.mongodb_images) {
                this.collections.images = db.collection("images");
            }
            
        } catch(err) {
            await this.close();
            this.log.error(err);
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
        if(this.client_images !== undefined) {
            await this.client_images.close();
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
            this.log.error("getSessionStore() failed: No database connection");
            throw new LoggedError();
        } else {
            return MongoStore.create({
                "client": this.client,
                "dbName": this.config.mongodb.database,
                "crypto": {
                    "secret": this.config.session.secret
                }
            });
        }
    }

    /**
     * Get user by email and password
     * 
     * @param ip Client IP address
     * @param email - User email
     * @param password - User password
     * @return UserInfo
     * @throws InputError, LoggedError
     */
    public async getUser(ip: string, email: string, password: string): Promise<UserInfo> {
        try {
            // Limit access
            await this.ipBlockCheck(ip, ClientAction.login);

            // Get collection
            const users = this.getCollection("users");

            // Hash email
            const email_lower = email.toLocaleLowerCase("de-DE");
            const email_hash = createHash(this.config.crypto.email_hash).update(email_lower).digest("hex");

            // Get user data
            const ret = await users.findOne<User>({
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

            // Check password
            const salt = Buffer.from(ret.salt, "hex");
            const derivedKey = scryptSync(password, salt, this.config.crypto.key_length);
            if(derivedKey.toString("hex") !== ret.key) {
                throw new InputError("Invalid password");
            }

            return {
                "id": ret.id,
                "age": ret.age,
                "gender": ret.gender,
                "groups": ret.groups
            };
        } catch(exc) {
            if(exc instanceof InputError || exc instanceof LoggedError) {
                throw exc;
            }
            this.log.error("getUser() failed: ", exc);
            throw new LoggedError();
        }
    }

    /**
     * Add new user
     * 
     * @param ip Client IP adress
     * @param email Email address of new user
     * @param password User password
     * @throws InputError, LoggedError
     */
    public async addUser(ip: string, email: string, password: string): Promise<void> {
        try {
            // Limit access
            await this.ipBlockCheck(ip, ClientAction.register);

            // Get collection
            const users = this.getCollection("users");

            // Hash email
            const email_lower = email.toLocaleLowerCase("de-DE");
            const email_hash = createHash(this.config.crypto.email_hash).update(email_lower).digest("hex");

            // Check if email exists already
            const check = await users.findOne({
                "email": email_hash
            }, {
                "projection": {
                    "_id": 1
                }
            });
            if(check !== null) {
                throw new InputError("Email already exits.")
            }

            // Create salt, key and token
            const salt = randomBytes(this.config.crypto.salt_bytes);
            const key = scryptSync(password, salt, this.config.crypto.key_length);
            const salt_str = salt.toString("hex");
            const key_str = key.toString("hex");
            const token_str = await this.getUniqueToken();

            // Prepare email content
            const email_url = this.config.base_url + "/user/validate?token=" + token_str;
            const email_text = this.config.email.content.register.text.replace("${url}", email_url);
            const email_html = this.config.email.content.register.html.replace("${url}", email_url);
            const email_subject = this.config.email.content.register.subject;

            // Insert user into database
            const session = this.startSession();
            try {
                this.startTransaction(session);

                const ret = await users.insertOne({
                    "email": email_hash,
                    "key": key_str,
                    "salt": salt_str,
                    "gender": "",
                    "age": 0,
                    "groups": {
                        "gamer": false,
                        "journalist": false,
                        "scientist": false,
                        "critic": false,
                        "wasted": false
                    },
                    "token": token_str
                }, {
                    "session": session
                });
                if(!ret.acknowledged) {
                    throw new Error("Failed to insert new user into database");
                }
                // Try to send validation email
                await this.mail.send(email_lower, email_subject, email_text, email_html);

                await session.commitTransaction();
            } catch(exc) {
                await session.abortTransaction();
                throw exc;
            } finally {
                await session.endSession();
            }
        } catch(exc) {
            if(exc instanceof InputError || exc instanceof LoggedError) {
                throw exc;
            }
            this.log.error("addUser() failed: ", exc);
            throw new LoggedError();
        }
    }

    /**
     * Validate user
     * 
     * @param token Token string
     * @throws InputError, LoggedError
     */
    public async validateUser(token: string): Promise<void> {
        try {
            const users = this.getCollection("users");

            const ret = await users.updateOne({
                "token": token
            }, {
                "$unset": {
                    "token": ""
                }
            });
            if(ret.matchedCount !== 1) {
                throw new InputError("Invalid token");
            } else if(ret.modifiedCount !== 1) {
                throw new Error("Failed to update user");
            }
        } catch(exc) {
            if(exc instanceof InputError || exc instanceof LoggedError) {
                throw exc;
            }
            this.log.error("validateUser() failed: ", exc);
            throw new LoggedError();
        }
    }

    /**
     * Reset user for password change
     * 
     * @param ip Client IP address
     * @param email - User email
     * @throws InputError, LoggedError
     */
    public async resetUser(ip: string, email: string): Promise<void> {
        try {
            // Limit access
            await this.ipBlockCheck(ip, ClientAction.reset);

            // Get collection
            const users = this.getCollection("users");

            // Prepare token & email content
            const email_lower = email.toLocaleLowerCase("de-DE");
            const email_hash = createHash(this.config.crypto.email_hash).update(email_lower).digest("hex");
            const token = await this.getUniqueToken();
            const url = this.config.base_url + "/password?token=" + token;
            const email_text = this.config.email.content.reset.text.replace("${url}", url);
            const email_html = this.config.email.content.reset.html.replace("${url}", url);
            const email_subject = this.config.email.content.register.subject;

            // Find user
            const user = await users.findOne({
                "email": email_hash,
                "token": { "$exists": false }
            }, {
                "projection": { _id: 1 }
            });
            if(user === null) {
                throw new InputError("User not found"); 
            }

            // Update user (session because email might fail)
            const session = this.startSession();
            try {
                this.startTransaction(session);

                const ret = await users.updateOne({
                    "_id": user._id
                }, {
                    "$set": {
                        "token": token
                    }
                }, {
                    "session": session
                });
                if(ret.modifiedCount !== 1) {
                    throw new Error("Failed to update user");
                }

                // Try to send password reset email
                await this.mail.send(email_lower, email_subject, email_text, email_html);

                await session.commitTransaction();
            } catch(exc) {
                await session.abortTransaction();
                throw exc;
            } finally {
                await session.endSession();
            }
        } catch(exc) {
            if(exc instanceof InputError || exc instanceof LoggedError) {
                throw exc;
            }
            this.log.error("resetUser() failed: ", exc);
            throw new LoggedError();
        }
    }

    /**
     * Set new user password
     * 
     * @param token - Token string
     * @param password - New password
     * @throws InputError, LoggedError
     */
    public async setUserPassword(token: string, password: string): Promise<void> {
        try {
            const users = this.getCollection("users");

            // Create salt and key
            const salt = randomBytes(this.config.crypto.salt_bytes);
            const key = scryptSync(password, salt, this.config.crypto.key_length);
            const salt_str = salt.toString("hex");
            const key_str = key.toString("hex");

            // Update database
            const ret = await users.updateOne({
                "token": token
            }, {
                "$set": {
                    "key": key_str,
                    "salt": salt_str
                },
                "$unset": {
                    "token": ""
                }
            });
            if(ret.matchedCount !== 1) {
                throw new InputError("User not found");
            } else if(ret.modifiedCount !== 1) {
                throw new Error("Failed to update user");
            }
        } catch(exc) {
            if(exc instanceof InputError || exc instanceof LoggedError) {
                throw exc;
            }
            this.log.error("setUserPassword() failed: ", exc);
            throw new LoggedError();
        }
    }

    /**
     * Delete user from database
     * 
     * @param id User id string
     * @throws LoggedError
     */
    public async deleteUser(id: string): Promise<void> {
        try {
            const users = this.getCollection("users");
            const votes = this.getCollection("votes");
            if(id.length !== 24) {
                throw new Error("Invalid user id");
            }
            const oid = ObjectId.createFromHexString(id);

            const session = this.startSession();
            try {
                this.startTransaction(session);

                const ret = await users.deleteOne({
                    "_id": oid
                }, {
                    "session": session
                });
                if(ret.deletedCount !== 1) {
                    throw new Error("Failed to delete user");
                }
                await votes.deleteMany({
                    "user_id": oid
                }, {
                    "session": session
                });

                await session.commitTransaction();
            } catch(exc) {
                await session.abortTransaction();
                throw exc;
            } finally {
                await session.endSession();
            }
        } catch(exc) {
            if(exc instanceof InputError || exc instanceof LoggedError) {
                throw exc;
            }
            this.log.error("deleteUser() failed: ", exc);
            throw new LoggedError();
        }
    }

    /**
     * Update user information
     * 
     * @param user UserInfo
     * @throws InputError, LoggedError
     */
    public async updateUser(user: UserInfo): Promise<void> {
        try {
            if(user.id.length !== 24) {
                throw new Error("Invalid user id");
            }
            const user_id = ObjectId.createFromHexString(user.id);

            const users = this.getCollection("users");
            const votes = this.getCollection("votes");

            const session = this.startSession();
            try {
                this.startTransaction(session);

                // Update user
                const ret = await users.updateOne({
                    "_id": user_id
                }, { "$set": {
                    "age": user.age,
                    "gender": user.gender,
                    "groups": user.groups
                } }, {
                    "session": session
                });

                if(ret.matchedCount !== 1) {
                    throw new InputError("User not found");
                }

                // Update all user votes
                await votes.updateMany({
                    "user_id": user_id,
                }, { "$set": {
                    "user_age": user.age,
                    "user_gender": user.gender,
                    "user_groups": user.groups
                } }, {
                    "session": session
                });

                await session.commitTransaction();
            } catch(exc) {
                await session.abortTransaction();
                throw exc;
            } finally {
                await session.endSession();
            }
        } catch(exc) {
            if(exc instanceof InputError || exc instanceof LoggedError) {
                throw exc;
            }
            this.log.error("updateUser() failed: ", exc);
            throw new LoggedError();
        }
    }

    /**
     * Update user vote
     * 
     * @param user UserInfo
     * @param position Game rank/position
     * @param game_id Game ID in database
     * @throws InputError, LoggedError
     */
    public async updateVote(user: UserInfo, position: number, game_id: string): Promise<void> {
        try {
            const games = this.getCollection("games");
            const votes = this.getCollection("votes");

            // Validate input
            if(user.id.length !== 24) {
                throw new Error("Invalid user id");
            }
            if(game_id.length !== 24) {
                throw new Error("Invalid game id");
            }
            if(!(Number.isInteger(position) && position > 0 && position <= 100)) {
                throw new Error("Invalid position");
            }

            // Find game
            const game_oid = ObjectId.createFromHexString(game_id);
            const game = await games.findOne({
                "_id": game_oid
            }, {
                "projection": {
                    "title": 1,
                    "moby_id": 1,
                    "year": 1,
                    "platforms": "$platforms.name",
                    "genres": 1,
                    "gameplay": 1,
                    "perspectives": 1,
                    "settings": 1,
                    "topics": 1
                }
            });
            if(game === null) {
                throw new InputError("Game not found");
            }

            // Update vote
            const user_oid = ObjectId.createFromHexString(user.id);
            const ret = await votes.updateOne({
                "user_id": user_oid,
                "position": position,
                "user_age": user.age,
                "user_gender": user.gender,
                "user_groups": user.groups
            }, { "$set": {
                "game_id": game_oid,
                "game_title": game.title,
                "game_year": game.year,
                "game_moby_id": game.moby_id,
                "game_genres": game.genres,
                "game_gameplay": game.gameplay,
                "game_perspectives": game.perspectives,
                "game_settings": game.settings,
                "game_topics": game.topics,
                "game_platforms": game.platforms
            } }, {
                "upsert": true
            });

            if(ret.modifiedCount !== 1 && ret.upsertedCount !== 1) {
                throw new Error("Failed to update database");
            }
        } catch(exc) {
            if(exc instanceof InputError || exc instanceof LoggedError) {
                throw exc;
            }
            this.log.error("updateVote() failed", exc);
            throw new LoggedError();
        }
    }

    /**
     * Update comment
     * 
     * @param user_id User id
     * @param position Position/rank of game
     * @param comment Comment string
     * @throws InputError, LoggedError
     */
    public async updateComment(user_id: string, position: number, comment: string): Promise<string> {
        try {
            const votes = this.getCollection("votes");

            // Validate input
            if(user_id.length !== 24) {
                throw new Error("Invalid user id");
            }

            // Update comment
            const ret = await votes.findOneAndUpdate({
                "user_id": ObjectId.createFromHexString(user_id),
                "position": position
            }, { "$set": {
                "comment": comment
            } }, { "projection": { "comment": 1 }, "returnDocument": "after"});

            if(ret === null) {
                throw new Error("Failed to update comment");
            }

            return ret.comment as string;

            //if(ret.matchedCount !== 1) {
            //    throw new Error("Failed to match vote");
            //}
        } catch(exc) {
            if(exc instanceof InputError || exc instanceof LoggedError) {
                throw exc;
            }
            this.log.error("updateComment() failed: ", exc);
            throw new LoggedError();
        }
    }

    /**
     * Get all votes of user
     * 
     * @param user_id User id
     * @returns Array of vote info
     * @throws LoggedError
     */
    public async getVotes(user_id: string): Promise<VoteGame[]> {
        try {
            if(user_id.length !== 24) {
                throw new Error("Invalid user id");
            }
            const user_oid = ObjectId.createFromHexString(user_id);
            const votes = this.getCollection("votes");

            const ret = await votes.aggregate<VoteGame>([
                { "$match": {
                    "user_id": user_oid
                } },
                { "$lookup": {
                    "from": "games",
                    "let": { "game_id": "$game_id" },
                    "pipeline": [
                        { "$match": { 
                            "$expr": { "$eq": ["$_id","$$game_id"] }
                        } },
                        { "$project": {
                            "_id": 0,
                            "title": 1,
                            "platforms": 1,
                            "year": 1,
                            "icon": 1
                        } }
                    ],
                    "as": "info"
                } },
                { "$project": {
                    "_id": 0,
                    "position": "$position",
                    "comment": "$comment",
                    "id": { "$toString" : "$game_id" },
                    "title": { "$arrayElemAt": [ "$info.title", 0 ] },
                    "year": { "$arrayElemAt": [ "$info.year", 0 ] },
                    "platforms": { "$arrayElemAt": [ "$info.platforms", 0 ] },
                    "icon": { "$arrayElemAt": [ "$info.icon", 0 ] },
                } }
            ]).toArray();
            return ret;
        } catch(exc) {
            if(exc instanceof InputError || exc instanceof LoggedError) {
                throw exc;
            }
            this.log.error("getVotes() failed: ", exc);
            throw new LoggedError();
        }
    }

    /**
     * Get complete vote data
     * 
     * @param ip Client IP address
     * @returns Array of votes
     * @throws InputError, LoggedError
     */
    public async getData(ip: string) {
        try {
            // Limit access
            await this.ipBlockCheck(ip, ClientAction.data);

            const votes = this.getCollection("votes");

            // Get data
            const ret = await votes.find({}, {
                "projection": {
                    "_id": 0,
                    "user": { "$toString": "$user_id" },
                    "age": "$user_age",
                    "gender": "$user_gender",
                    "wasted": "$user_groups.wasted",
                    "gamer": "$user_groups.gamer",
                    "journalist": "$user_groups.journalist",
                    "critic": "$user_groups.critic",
                    "scientist": "$user_groups.scientist",
                    "position": 1,
                    "game": "$game_title",
                    "year": "$game_year",
                    "moby_id": "$game_moby_id",
                    "genres": "$game_genres",
                    "gameplay": "$game_gameplay",
                    "perspectives": "$game_perspectives",
                    "settings": "$game_settings",
                    "topics": "$game_topics",
                    "platforms": "$game_platforms"
                }
            }).toArray();
            return ret;
        } catch(exc) {
            if(exc instanceof InputError || exc instanceof LoggedError) {
                throw exc;
            }
            this.log.error("getData() failed: ", exc);
            throw new LoggedError();
        }
    }

    /**
     * Get information about votes collection
     * 
     * @param options Filter options
     * @returns Statistics about current votes
     * @throws LoggedError
     */
    public async getVoteStatistics(options: FilterOptions): Promise<VoteStatistics> {
        try {
            const votes = this.getCollection("votes");
            const query = this.getFilterQuery(options);

            const ret = await votes.aggregate<VoteStatistics>([
                { "$match": query },
                { "$facet": {
                    "genres": [
                        { "$replaceWith": { "genre": "$game_genres" } },
                        { "$unwind": {
                            "path": "$genre"
                        } },
                        { "$group": {
                            "_id": "$genre",
                            "count": { "$sum": 1 }
                        } },
                        { "$project": {
                            "name": "$_id",
                            "count": 1,
                            "_id": 0
                        } }
                    ],
                    "gameplay": [
                        { "$replaceWith": { "gameplay": "$game_gameplay" } },
                        { "$unwind": {
                            "path": "$gameplay"
                        } },
                        { "$group": {
                            "_id": "$gameplay",
                            "count": { "$sum": 1 }
                        } },
                        { "$project": {
                            "name": "$_id",
                            "count": 1,
                            "_id": 0
                        } }
                    ],
                    "perspectives": [
                        { "$replaceWith": { "perspective": "$game_perspectives" } },
                        { "$unwind": {
                            "path": "$perspective"
                        } },
                        { "$group": {
                            "_id": "$perspective",
                            "count": { "$sum": 1 }
                        } },
                        { "$project": {
                            "name": "$_id",
                            "count": 1,
                            "_id": 0
                        } }
                    ],
                    "settings": [
                        { "$replaceWith": { "setting": "$game_settings" } },
                        { "$unwind": {
                            "path": "$setting"
                        } },
                        { "$group": {
                            "_id": "$setting",
                            "count": { "$sum": 1 }
                        } },
                        { "$project": {
                            "name": "$_id",
                            "count": 1,
                            "_id": 0
                        } }
                    ],
                    "topics": [
                        { "$replaceWith": { "topic": "$game_topics" } },
                        { "$unwind": {
                            "path": "$topic"
                        } },
                        { "$group": {
                            "_id": "$topic",
                            "count": { "$sum": 1 }
                        } },
                        { "$project": {
                            "name": "$_id",
                            "count": 1,
                            "_id": 0
                        } }
                    ],
                    "platforms": [
                        { "$replaceWith": { "platforms": "$game_platforms" } },
                        { "$unwind": {
                            "path": "$platforms"
                        } },
                        { "$group": {
                            "_id": "$platforms",
                            "count": { "$sum": 1 }
                        } },
                        { "$project": {
                            "name": "$_id",
                            "count": 1,
                            "_id": 0
                        } }
                    ],
                    "decades": [
                        { "$bucket": {
                            "groupBy": "$game_year",
                            "boundaries": [
                                1960,
                                1970,
                                1980,
                                1990,
                                2000,
                                2010,
                                2020,
                                2030
                            ],
                            "output": {
                                "count": {
                                    $sum: 1
                                }
                            }
                        } },
                        { "$project": {
                            "_id": 0,
                            "name": { 
                                "$concat": [
                                    { "$toString": "$_id" },
                                    " - ",
                                    { "$toString": { "$add":  ["$_id", 9] } }
                                ] 
                            },
                            "count": 1
                        } }
                    ]
                } }
            ]).next();

            if(ret === null) {
                throw new Error("Failed to get vote statistics");
            }
            return ret;
        } catch(exc) {
            if(exc instanceof InputError || exc instanceof LoggedError) {
                throw exc;
            }
            this.log.error("getVoteStatistics() failed: ", exc);
            throw new LoggedError();
        }
    }

    /**
     * Get page of top1000 list
     * 
     * @param page Page offset [1-99999]
     * @param limit Number of games per page
     * @param options Filter options
     * @returns List data
     * @throws InputError, LoggedError
     */
    public async getList(page: number, limit: number, options: FilterOptions) {
        try {
            // Validate input
            if(!(Number.isInteger(page) && page > 0 && page < 99999)) {
                throw new InputError("Invalid page");
            }
            if(!(Number.isInteger(limit) && limit >= 5 && limit <= 500)) {
                throw new InputError("Invalid limit");
            }

            const votes = this.getCollection("votes");
            const query = this.getFilterQuery(options);

            const weight = this.config.vote_weight.linear;

            const linear_n = (weight.votes_per_user * weight.max_weight - 1) / (weight.votes_per_user - 1)
            const linear_m = (1 - weight.max_weight) / (weight.votes_per_user - 1)

            // Get data
            const ret = await votes.aggregate([
                { "$match": query },
                { "$group": {
                    "_id": "$game_id",
                    "score": { "$sum": { "$add": [linear_n, { "$multiply": [linear_m, "$position"]}] } },
                    "comments": { "$push": "$comment" },
                    "votes" : { "$sum": 1 }
                } },
                { "$facet": {
                    "meta": [ { "$count": "total" } ],
                    "data": [
                        { "$sort": {
                            "score": -1,
                            "_id": 1
                        }},
                        { "$skip": (page - 1) * limit },
                        { "$limit": limit },
                        { "$lookup": {
                            "from": "games",
                            "let": { "game_id": "$_id" },
                            "pipeline": [
                                { "$match": { 
                                    "$expr": { "$eq": ["$_id","$$game_id"] }
                                } },
                                { "$project": {
                                    "_id": 0,
                                    "id": { "$toString" : "$_id" },
                                    "title": 1,
                                    "moby_id": 1,
                                    "description": 1,
                                    "genres": 1,
                                    "screenshot": 1,
                                    "platforms": 1,
                                    "year": 1,
                                    "cover": 1,
                                    "icon": 1
                                } }
                            ],
                            "as": "game"
                        } },
                        { "$project": {
                            "_id": 0,
                            "score": "$score",
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
                "limit": limit
            };
        } catch(exc) {
            if(exc instanceof InputError || exc instanceof LoggedError) {
                throw exc;
            }
            this.log.error("getList() failed: ", exc);
            throw new LoggedError();
        }
    }

    /**
     * Get image data
     * 
     * @param imageid ObjectId of image as string
     * @returns ImageBuffer
     * @throws InputError, LoggedError
     */
    public async getImage(imageid: string): Promise<ImageBuffer> {
        try {
            if(imageid.length != 24) {
                throw new InputError("Invalid image id");
            }
            const image_oid = ObjectId.createFromHexString(imageid);
            const images = this.getCollection("images");

            const image = await images.findOne<ImageBuffer>({
                "_id": image_oid
            },
            { "projection": {
                "data": 1, "mime": 1, "width": 1, "height": 1, "_id": 0
            }});
            if(image === null) {
                throw new InputError("Image not found");
            }
            return image;
        } catch(exc) {
            if(exc instanceof InputError || exc instanceof LoggedError) {
                throw exc;
            }
            this.log.error("getImage() failed: ", exc);
            throw new LoggedError();
        }
    }

    /**
     * Search games database (for autocomplete)
     * 
     * @param term Search term (game title)
     * @param page integer page offset (optional)
     * @returns Search results
     * @throws LoggedError
     */
    public async search(term: string, page?: number) {
        try {
            // Get offset
            let offset = 0;
            if(page !== undefined && Number.isInteger(page) && page > 0 && page < 100000) {
                offset = (page - 1) * this.config.search_results_max;
            }

            const games = this.getCollection("games");

            const res = await games.aggregate([
                { "$match": {
                    "title": this.getSearchRegex(term)
                } },
                { "$sort": { "title": 1 } },
                { "$facet": {
                    "metadata": [ { "$count": "total" } ],
                    "data": [
                        { "$skip": offset },
                        { "$limit": this.config.search_results_max },
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

            // Return data in form select2 understands
            if(res !== null && res.data.length > 0) {
                return {
                    "results": res.data,
                    "pagination": {
                        "more": (res.metadata[0].total > offset + this.config.search_results_max)
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
            if(exc instanceof InputError || exc instanceof LoggedError) {
                throw exc;
            }
            this.log.error("search() failed: ", exc);
            throw new LoggedError();
        }
    }

    /**
     * Add game to database
     * 
     * @param ip Client IP
     * @param moby_ident Mobygames game URL
     * @throws InputError, LoggedError
     */
    public async addGame(ip: string, moby_ident: string | number): Promise<void> {
        try {
            // Limit access
            await this.ipBlockCheck(ip, ClientAction.addgame);

            // Get modygames id from ident
            let moby_id: number;
            if(typeof moby_ident === "number") {
                if(!Number.isInteger(moby_ident)) {
                    throw new InputError("Invalid moby ident");
                }
                moby_id = moby_ident;
            } else {
                if(moby_ident.match(/^[0-9]{1,10}$/)) {
                    moby_id = Number.parseInt(moby_ident);
                } else {
                    const split_url = moby_ident.match(/^((http|https):\/\/)?www\.mobygames\.com\/game\/([0-9]+)(\/[a-z0-9\-_/]+)?$/);
                    if(split_url === null) {
                        throw new InputError("Invalid moby url or id");
                    }
                    moby_id = Number.parseInt(split_url[3]);
                }
            }
            if(Number.isNaN(moby_id) || moby_id <= 0) {
                throw new InputError("Invalid moby ident");
            }

            // Check if game is already in database
            const games = this.getCollection("games");
            const test = await games.findOne({
                "moby_id": moby_id
            }, {
                "projection": { "_id": 1 }
            });
            if(test !== null) {
                throw new InputError("Game already in database");
            }

            // Get data from mobygames.com
            const game = await this.moby.getGame(moby_id);

            // Try to download images to database
            if(game.cover.length > 0) {
                try {
                    const oid = await this.insertImage(game.cover, 200, 240);
                    game.cover = "image/" + oid.toString();
                } catch(err) {
                    this.log.error(err);
                }
            }
            if(game.screenshot.length > 0) {
                try {
                    const oid = await this.insertImage(game.screenshot, 300, 150);
                    game.screenshot = "image/" + oid.toString();
                } catch(err) {
                    this.log.error(err);
                }
            }

            // Insert game into database
            const ret = await games.insertOne(game);
            if(!ret.acknowledged) {
                throw new Error("Failed to insert game into database");
            }
            this.log.info("Added game \"" + game.title + "\" with moby_id " + game.moby_id + ".");
        } catch(exc) {
            if(exc instanceof InputError || exc instanceof LoggedError) {
                throw exc;
            }
            this.log.error("addGame() failed: ", exc);
            throw new LoggedError();
        }
    }

    /**
     * Add resized image to database
     * 
     * @param url Image url
     * @param width Resize width
     * @param height Resize height
     * @returns ObjectId
     * @throws Error
     */
    private async insertImage(url: string, width: number, height: number): Promise<ObjectId> {
        const images = this.getCollection("images");
        const image = await this.images.get(url);

        const opt: ResizeOptions = {
            "fit": "fill",
            "width": width,
            "height": height
        }
        const buffer = await sharp(image.data).resize(opt).webp({"alphaQuality": 0, "lossless": false, "quality": 80}).toBuffer();

        const ret = await images.insertOne({
            "mime": "image/webp",
            "width": width,
            "height": height,
            "data": buffer
        });
        if(!ret.acknowledged) {
            throw new Error("Failed to insert image into database");
        }
        return ret.insertedId;
    }

    /**
     * Check if client is allowed to do something
     * 
     * @param ip Client IP address
     * @param action Client action
     * @throws InputError, LoggedError
     */
    private async ipBlockCheck(ip: string, action: ClientAction) {
        try {
            const ipblock = this.getCollection("ipblock");

            const minutes = this.config.ipblock[action].minutes;
            const max = this.config.ipblock[action].max;

            const ip_hash = createHash(this.config.crypto.ip_hash).update(ip).digest("hex");

            // Delete old records
            await ipblock.deleteMany({
                "action": action,
                "timestamp": {
                    $lte: new Date(Date.now() - 60000 * minutes)
                }
            });

            // Check if client is blocked
            const ip_check = await ipblock.findOne({
                "ip": ip_hash,
                "action": action,
                "count": { "$gte": max }
            });
            if(ip_check !== null) {
                throw new InputError(`Only ${max} tries in ${minutes} minutes permitted.`);
            }

            // Update record
            await ipblock.updateOne({
                "ip": ip_hash,
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
            this.log.error("ipBlockCheck() failed: ", exc);
            throw new LoggedError();
        }
    }

    /**
     * Get search regex from string
     * 
     * @param s Search term string
     * @returns RegExp
     */
    private getSearchRegex(s: string): RegExp {
        const map: {[key:string]: string} = {
            "a": "[aáàâ]",
            "e": "[eéèê]",
            "i": "[iíìî]",
            "o": "[oóòô]",
            "u": "[uúùû]",
            ":": "",
            ".": "\\.",
            "*": "\\*",
            "+": "\\+",
            "?": "\\?",
            "^": "\\^",
            "$": "\\$",
            "{": "\\{",
            "}": "\\}",
            "(": "\\(",
            ")": "\\)",
            "|": "\\|",
            "[": "\\[",
            "]": "\\]",
            "\\": ""
        };
        const regex_map = /[aeiou:.*+?^${}()|[\]\\]/g;
        const regex_words = /[ ]+/g;
        const str = s.toLowerCase().replace(regex_map, m => { 
            return map[m];
        }).replace(regex_words, ".*");
        return new RegExp(str, "gi");
    }

    /**
     * Get database collection
     * 
     * @param name Collection name
     * @returns Collection
     * @throws Error
     */
    private getCollection(name: string): Collection {
        if(this.collections[name] === undefined) {
            throw new Error("Collection not found");
        }
        return this.collections[name];
    }

    /**
     * Start database session
     * 
     * @returns ClientSession
     */
    private startSession(): ClientSession {
        if(this.client === undefined) {
            throw new Error("Database client undefined");
        }
        return this.client.startSession();
    }

    /**
     * Start database transaction
     * 
     * @param session Mongodb client session
     */
    private startTransaction(session: ClientSession): void {
        session.startTransaction({
            "readPreference": ReadPreference.primaryPreferred,    
            "readConcern": { level: "local" },    
            "writeConcern": { w: "majority" }    
        });
    }

    /**
     * Create unique token string
     * 
     * @returns Token string
     * @throws Error
     */
    private async getUniqueToken(): Promise<string> {
        const users = this.getCollection("users");
        for(let i = 0; i < 20; i++) {
            const token = randomBytes(this.config.crypto.token_bytes).toString("hex");

            const ret = await users.findOne({
                "token": token
            });

            if(ret === null)  {
                return token;
            }
        }
        throw new Error("Failed to create new token");
    }

    /**
     * Get database query from list filter Options
     * 
     * @param options FilterOptions
     * @returns Mongodb query
     */
    private getFilterQuery(options: FilterOptions): Document {
        // Construct query object
        const query: Document = {};
        if(options.gender !== undefined) {
            query.user_gender = options.gender.toString();
        }
        if(options.age !== undefined) {
            query.user_age = options.age;
        }
        if(options.group !== undefined) {
            query["user_groups." + options.group.toString()] = true;
        }
        return query;
    }
}
