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

import { createHash, scryptSync, randomBytes } from "crypto";
import MongoStore from "connect-mongo";
import { Store as SessionStore } from "express-session";
import { Logger } from "winston";
import { MongoClient, ReadPreference, Collection, MongoClientOptions, ObjectId, Document, TransactionOptions } from "mongodb";
import { VoteGame, User, UserInfo, ClientAction, VotesStatistics, FilterOptions } from "./types";
import { InputError, LoggedError } from "./exceptions";
import { getMobygamesInfo, getMobyIDFromURL, sendEmail } from "./help";
import config from "./config";

/* ------------------------------------------------------------------------------------------------------------------------------------------ */
// Constants

/**
 * Determines the weight of each vote. A linear distribution is assumed from 1 for the last place (=VOTES_PER_USER) to MAX_SCORE for the first.
 */
const VOTES_PER_USER = 30;
const MAX_SCORE = 10;

// Slope of the "score" straight
const LINEAR_M = (1 - MAX_SCORE) / (VOTES_PER_USER - 1);
// y-intercept
const LINEAR_N = (VOTES_PER_USER * MAX_SCORE - 1) / (VOTES_PER_USER - 1);

// Size of salt used for key generation
const SALT_BYTES = 32;
// Length of password key in bytes
const KEY_LENGTH = 64;
// Token length (for user validation) in bytes
const TOKEN_LENGTH = 32;

// Page length of search results (autocomplete)
const SEARCH_LIMIT = 20;

// Length of ip block for various actions in tries/minutes
const ipblock_length = {
    "login": {
        "max": 10,
        "minutes": 15
    },
    "register": {
        "max": 1,
        "minutes": 30
    },
    "reset": {
        "max": 3,
        "minutes": 120
    },
    "data": {
        "max": 10,
        "minutes": 15
    },
    "addgame": {
        "max": 5,
        "minutes": 10
    }
}

const emails = {
    "reset": {
        "subject": "Wasted Top1000 Passwortzurücksetzung",
        "text": "Um dein Passwort für die Wasted Top1000 zurückzusetzen folge bitte diesem Link: ${url}",
        "html": "Hi,<br><br>um dein Passwort für die Wasted Top1000 zurückzusetzen, klicke bitte auf folgenden <a href=\"${url}\">Link</a>.<br><br>Schöne Grüße!"
    },
    "register": {
        "subject": "Wasted Top1000 Accountverifizierung",
        "text": "Um deinen Account bei Wasted Top1000 freizuschalten, klicke bitte auf folgenden Link: ${url}",
        "html": "Hi,<br><br>um deinen Account bei Wasted Top1000 freizuschalten, klicke bitte auf folgenden <a href=\"${url}\">Link</a>.<br><br>Schöne Grüße!"
    }
}

/* ------------------------------------------------------------------------------------------------------------------------------------------ */

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

    /* ------------------------------------------------------------------------------------------------------------------------------------------ */

    /**
     * Get validated user by email and password
     * 
     * @param ip Client IP address
     * @param email - User email
     * @param password - User password
     * @return UserInfo
     * @throws InputError, LoggedError
     */
    public async getUser(ip: string, email: string, password: string): Promise<UserInfo> {
        try {
            if(this.users === undefined || this.ipblock === undefined) {
                throw new Error("No database connection");
            }
            // Limit access
            await this.ipBlockCheck(ip, ClientAction.login);

            // Hash email
            const email_lower = email.toLocaleLowerCase("de-DE");
            const email_hash = createHash("sha256").update(email_lower).digest("hex");

            // Get user data
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

            // Check password
            const salt = Buffer.from(ret.salt, "hex");
            const derivedKey = scryptSync(password, salt, KEY_LENGTH);
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
            if(exc instanceof InputError) {
                throw exc;
            }
            this.log.error(exc);
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
            if(this.users === undefined) {
                throw new Error("No database connection");
            }
            // Limit access
            await this.ipBlockCheck(ip, ClientAction.register);

            const email_lower = email.toLocaleLowerCase("de-DE");
            const email_hash = createHash("sha256").update(email_lower).digest("hex");

            // Check if email exists already
            const check = await this.users.findOne({
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
            const salt = randomBytes(SALT_BYTES);
            const key = scryptSync(password, salt, KEY_LENGTH);
            const token = randomBytes(TOKEN_LENGTH);

            const salt_str = salt.toString("hex");
            const key_str = key.toString("hex");
            const token_str = token.toString("hex");

            // Insert into database
            const ret = await this.users.insertOne({
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
                "creation_date": new Date(),
                "token": token_str
            });
            if(!ret.acknowledged) {
                throw new Error("Failed to insert new user into database");
            }
            try {
                // Try to send validation email
                const url = config.base_url + "/validate?token=" + token_str;
                await sendEmail({
                    "to": email_lower,
                    "subject": emails.register.subject,
                    "text": emails.register.text.replace("${url}", url),
                    "html": emails.register.html.replace("${url}", url)
                });
            } catch(err) {
                // Delete user if sendEmail failed
                await this.deleteUser(ret.insertedId);
                throw err;
            }
        } catch(exc) {
            if(exc instanceof InputError || exc instanceof LoggedError) {
                throw exc;
            }
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /**
     * Validate new user
     * 
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
     * Reset user for password change
     * 
     * @param ip Client IP address
     * @param email - User email
     * @throws InputError, LoggedError
     */
     public async resetUser(ip: string, email: string): Promise<void> {
        try {
            if(this.users === undefined) {
                throw new Error("No database connection");
            }

            // Limit access
            await this.ipBlockCheck(ip, ClientAction.reset);

            const email_lower = email.toLocaleLowerCase("de-DE");
            const email_hash = createHash("sha256").update(email_lower).digest("hex");
            const token = randomBytes(TOKEN_LENGTH).toString("hex");

            // Update user with new token
            const ret = await this.users.updateOne({
                "email": email_hash,
                "token": { "$exists": false }
            }, {
                "$set": {
                    "token": token
                }
            });
            if(ret.matchedCount !== 1) {
                throw new InputError("User not found");
            }
            
            try {
                // Try to send password reset email
                const url = config.base_url + "/password?token=" + token;
                await sendEmail({
                    "to": email_lower,
                    "subject": emails.reset.subject,
                    "text": emails.reset.text.replace("${url}", url),
                    "html": emails.reset.html.replace("${url}", url)
                });
            } catch(err) {
                // Delete token if sendEmail failed
                await this.users.updateOne({
                    "email": email_hash,
                    "token": token
                }, {
                    "$unset": {
                        "token": ""
                    }
                });
                throw err;
            }
        } catch(exc) {
            if(exc instanceof InputError) {
                throw exc;
            }
            this.log.error(exc);
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
            if(this.users === undefined) {
                throw new Error("No database connection");
            }

            // Create salt and key
            const salt = randomBytes(SALT_BYTES);
            const key = scryptSync(password, salt, KEY_LENGTH);
            const salt_str = salt.toString("hex");
            const key_str = key.toString("hex");

            // Update database
            const ret = await this.users.updateOne({
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
            if(exc instanceof InputError) {
                throw exc;
            }
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /**
     * Delete user from database
     * 
     * @param id User ObjectId
     * @throws LoggedError
     */
    private async deleteUser(id: ObjectId): Promise<void> {
        try {
            if(this.users === undefined || this.votes === undefined) {
                throw new Error("No database connection");
            }
            const ret = await this.users.deleteOne({
                "_id": id
            });
            if(ret.deletedCount !== 1) {
                throw new Error("Failed to delete user");
            }
            await this.votes.deleteMany({
                "user_id": id
            });
        } catch(exc) {
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /* ------------------------------------------------------------------------------------------------------------------------------------------ */

    /**
     * Update user information
     * 
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

            // Create MongoDB session
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
                    "user_age": user.age,
                    "user_gender": user.gender,
                    "user_groups": user.groups
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
     * Update user vote
     * 
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
            const game_object_id = ObjectId.createFromHexString(game_id);
            const game = await this.games.findOne({
                "_id": game_object_id
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
            const ret = await this.votes.updateOne({
                "user_id": ObjectId.createFromHexString(user.id),
                "position": position,
                "user_age": user.age,
                "user_gender": user.gender,
                "user_groups": user.groups
            }, { "$set": {
                "game_id": game_object_id,
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
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /**
     * Update comment
     * 
     * @param user_id User id
     * @param position Position/rank of game
     * @param comment Comment string
     * @throws LoggedError
     */
    public async updateComment(user_id: string, position: number, comment: string): Promise<void> {
        try {
            if(this.votes === undefined) {
                throw new Error("No database connection");
            }

            // Validate input
            if(user_id.length !== 24) {
                throw new Error("Invalid user id");
            }
            if(!(Number.isInteger(position) && position > 0 && position <= 100)) {
                throw new Error("Invalid position");
            }

            // Update comment
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

    /* ------------------------------------------------------------------------------------------------------------------------------------------ */

    /**
     * Get all votes of user
     * 
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
            return ret as VoteGame[];
        } catch(exc) {
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /**
     * Get complete vote data
     * 
     * @returns Array of votes
     * @throws InputError, LoggedError
     */
    public async getData(ip: string, email: string, password: string) {
        try {
            if(this.votes === undefined || this.users === undefined) {
                throw new Error("No database connection");
            }

            // Limit access
            await this.ipBlockCheck(ip, ClientAction.data);

            // Find user
            const email_lower = email.toLocaleLowerCase("de-DE");
            const email_hash = createHash("sha256").update(email_lower).digest("hex");
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

            // Check password
            const salt = Buffer.from(user.salt, "hex");
            const test = scryptSync(password, salt, KEY_LENGTH).toString("hex");
            if(test !== user.key) {
                throw new InputError("Invalid password");
            }

            // Get data
            const ret = await this.votes.find({}, {
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
            if(exc instanceof InputError) {
                throw exc;
            }
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /**
     * Get information about votes collection
     * @returns Statistics about current votes
     */
    public async getVoteStatistics(options: FilterOptions): Promise<VotesStatistics> {
        try {
            if(this.votes === undefined) {
                throw new Error("No database connection");
            }

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

            const ret = await this.votes.aggregate<VotesStatistics>([
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
                } }
            ]).next();

            if(ret === null) {
                throw new Error("Failed to get vote statistics");
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
     * Get page of top1000 list
     * 
     * @param page Page offset [1-99999]
     * @param limit Number of games per page
     * @param gender Gender (optional)
     * @param age Age group (optional)
     * @param group Voter group (optional)
     * @returns List data
     * @throws InputError, LoggedError
     */
    public async getList(page: number, limit: number, options: FilterOptions) {
        try {
            if(this.votes === undefined) {
                throw new Error("No database connection");
            }

            // Validate input
            if(!(Number.isInteger(page) && page > 0 && page < 99999)) {
                throw new InputError("Invalid page");
            }
            if(!(Number.isInteger(limit) && limit >= 5 && limit <= 100)) {
                throw new InputError("Invalid limit");
            }

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

            // Get data
            const ret = await this.votes.aggregate([
                { "$match": query },
                { "$group": {
                    "_id": "$game_id",
                    "score": { "$sum": { "$add": [LINEAR_N, { "$multiply": [LINEAR_M, "$position"]}] } },
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
                                    "moby_url": 1,
                                    "description": 1,
                                    "genres": 1,
                                    "screenshots": 1,
                                    "platforms": 1,
                                    "year": 1,
                                    "cover_url": 1,
                                    "thumbnail_url": 1,
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
            if(exc instanceof InputError) {
                throw exc;
            }
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /**
     * Get sample screenshot data for game
     * @param gameid ObjectId of game
     * @returns Buffer
     * @throws InputError, LoggedError
     */
    public async getImage(gameid: string): Promise<Buffer> {
        try {
            if(this.games === undefined) {
                throw new Error("No database connection");
            }
            const game = await this.games.findOne({
                "_id": ObjectId.createFromHexString(gameid)
            },
            { "projection": {
                "image": 1
            }});
            if(game === null) {
                throw new InputError("Not found");
            }
            if(game.image !== undefined && game.image.buffer instanceof Buffer) {
                return game.image.buffer as Buffer;
            } else {
                return Buffer.from("");
            }
        } catch(exc) {
            if(exc instanceof InputError) {
                throw exc;
            }
            this.log.error(exc);
            throw new LoggedError();
        }
    }

    /**
     * Search games database (for autocomplete)
     * 
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

            // Get offset
            let offset = 0;
            if(page !== undefined && Number.isInteger(page) && page > 0 && page < 100000) {
                offset = (page - 1) * SEARCH_LIMIT;
            }

            const res = await this.games.aggregate([
                { "$match": {
                    "title": this.getSearchRegex(input)
                } },
                { "$sort": { "title": 1 } },
                { "$facet": {
                    "metadata": [ { "$count": "total" } ],
                    "data": [
                        { "$skip": offset },
                        { "$limit": SEARCH_LIMIT },
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
                        "more": (res.metadata[0].total > offset + SEARCH_LIMIT)
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
     * Add game to database
     * 
     * @param ip Client IP
     * @param moby_url Mobygames game URL
     * @throws InputError, LoggedError
     */
     public async addGame(ip: string, moby_url: string): Promise<void> {
        try {
            if(this.games === undefined) {
                throw new Error("No database connection");
            }

            // Limit access
            await this.ipBlockCheck(ip, ClientAction.addgame);

            // Scrape mobygames.com game id from url
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

    /* ------------------------------------------------------------------------------------------------------------------------------------------ */

    /**
     * Check if client is allowed to do something
     * 
     * @param ip Client IP address
     * @param action Client action
     * @throws InputError, LoggedError
     */
    private async ipBlockCheck(ip: string, action: ClientAction) {
        try {
            if(this.ipblock === undefined) {
                throw new Error("No database connection");
            }

            const minutes = ipblock_length[action].minutes;
            const max = ipblock_length[action].max;

            // Delete old records
            await this.ipblock.deleteMany({
                "action": action,
                "timestamp": {
                    $lte: new Date(Date.now() - 60000 * minutes)
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

    /**
     * Get search regex from string
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
}