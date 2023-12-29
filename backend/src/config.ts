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

import { join } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { isJSON } from "./help.js";
import { validateInteger, validateString } from "./validate.js";

export interface ConfigData {
    /** Port number of backend server */
    readonly port: number;

    /** Base URL of backend server. ie: https://top1000.server.com */
    readonly base_url: string;

    /** Logging options for backend server */ 
    readonly log: {
        /** File ie: "server.log", "/var/log/top1000.log" */
        file: string,
        /** Max file size in kilobytes */
        maxsize: number,
        /** Maximum number of logfiles in rotation */
        maxfiles: number
    }

    /** Mobygames.com api key */
    readonly moby_api_key: string;

    readonly mongodb: {
        /** Connection URI to mongodb server. */
        readonly uri: string,
        /** Name of top1000 database on mongodb server */
        readonly database: string
    }

    readonly mongodb_images?: {
        /** Connection URI to mongodb server. */
        readonly uri: string,
        /** Name of top1000 database on mongodb server */
        readonly database: string
    }

    readonly email: {
        readonly smtp: {
            /** SMTP Server address for register/reset emails */
            readonly server: string;
            /** SSL port of email server */
            readonly port: number;
            /** From email address to use */
            readonly address: string;
            /** Username on email server */
            readonly user: string;
            /** Password on email server */
            readonly password: string;
        }
        readonly content: {
            readonly reset: {
                /** Subject of reset password email */
                readonly subject: string;
                /** Text of reset password email */
                readonly text: string;
                /** HTML of reset password email */
                readonly html: string;
            }
            readonly register: {
                /** Subject of register email */
                readonly subject: string;
                /** Text of register email */
                readonly text: string;
                /** HTML of register email */
                readonly html: string;
            }
        }
    }

    readonly session: {
        /** Random string as secret for session store */
        readonly secret: string;
        /** Cookie/Session max age in milliseconds */
        readonly age: number;
    }

    readonly crypto: {
        /** Email hash algorithm */
        readonly email_hash: string,

        /** IP hash algorithm */ 
        readonly ip_hash: string,

        /** Length of random token for register & password reset */
        readonly token_bytes: number,

        /** Number of salt bytes for key derivation */
        readonly salt_bytes: number,

        /** Length of password derived key in bytes */
        readonly key_length: number
    }

    /** Maximum returned games per list page */
    readonly games_per_page: number;

    /** Max page length of search results (autocomplete) */
    readonly search_results_max: number;

    /** Ways to calculate the weight of votes */
    readonly vote_weight: {
        /** A linear distribution is assumed from 1 for the last place (=votes_per_user) to max_weight for the first. */
        readonly linear: {
            readonly votes_per_user: number,
            readonly max_weight: number,
        }
    }

    /** Length of ip block for various actions in tries/minutes */ 
    readonly ipblock: {
        readonly login: {
            readonly max: number,
            readonly minutes: number
        }
        readonly register: {
            readonly max: number,
            readonly minutes: number
        }
        readonly reset: {
            readonly max: number,
            readonly minutes: number
        }
        readonly data: {
            readonly max: number,
            readonly minutes: number
        }
        readonly addgame: {
            readonly max: number,
            readonly minutes: number
        }
    }
}

/**
 * Parses and validates config file
 */
export class ConfigFile implements ConfigData {
    public readonly port;
    public readonly base_url;
    public readonly log;
    public readonly moby_api_key;
    public readonly mongodb;
    public readonly mongodb_images?;
    public readonly email;    
    public readonly session;
    public readonly crypto;
    public readonly games_per_page;
    public readonly search_results_max;
    public readonly vote_weight;
    public readonly ipblock;

    constructor(filename: string) {
        try {
            const data = readFileSync(join(fileURLToPath(new URL('.', import.meta.url)), filename), { encoding: "utf-8" });
            const obj = JSON.parse(data);

            if(!isJSON(obj)) {
                throw new Error("No valid json object");
            }

            this.port = validateInteger(obj.port, "Invalid server port number (port) [1,65535]", 1, 65535);

            this.base_url = validateString(obj.base_url, "Invalid base url (base_url)", 1, 1024);

            if(typeof obj.log !== "object" || Array.isArray(obj.log)) {
                throw new Error("Invalid log options");
            }

            this.log = {
                "file": validateString(obj.log.file, "Invalid logfile", 1, 1024),
                "maxsize": validateInteger(obj.log.maxsize, "Invalid max log file size (log.maxsize)", 1, 10000),
                "maxfiles": validateInteger(obj.log.maxfiles, "Invalid max log files (log.maxfiles)", 1, 50)
            }

            this.moby_api_key = validateString(obj.moby_api_key, "Invalid mobygames api key (moby_api_key)", 8, 64);

            if(typeof obj.mongodb !== "object" || Array.isArray(obj.mongodb)) {
                throw new Error("Invalid mongodb options");
            }

            this.mongodb = {
                "uri": validateString(obj.mongodb.uri, "Invalid mongodb connection uri (mongodb.uri)", 1, 256),
                "database": validateString(obj.mongodb.database, "Invalid mongodb database name (mongodb.database)", 1, 256)
            };

            if(typeof obj.mongodb_images === "object" && !Array.isArray(obj.mongodb_images)) {
                this.mongodb_images = {
                    "uri": validateString(obj.mongodb_images.uri, "Invalid mongodb connection uri (mongodb.uri)", 1, 256),
                    "database": validateString(obj.mongodb_images.database, "Invalid mongodb database name (mongodb.database)", 1, 256)
                };
            }

            if(typeof obj.email !== "object" || Array.isArray(obj.email) || 
                typeof obj.email.smtp !== "object" || Array.isArray(obj.email.smtp) || 
                typeof obj.email.content !== "object" || Array.isArray(obj.email.content) ||
                typeof obj.email.content.reset !== "object" || Array.isArray(obj.email.content.reset) || 
                typeof obj.email.content.register !== "object" || Array.isArray(obj.email.content.register)) {
                throw new Error("Invalid email options");
            }

            this.email = {
                "smtp": {
                    "address": validateString(obj.email.smtp.address, "Invalid email address (email.smtp.address)", 1, 128),
                    "password": validateString(obj.email.smtp.password, "Invalid email password (email.smtp.password)", 1, 128),
                    "port": validateInteger(obj.email.smtp.port, "Invalid email smtp port (email.smtp.port)", 1, 65535),
                    "server": validateString(obj.email.smtp.server, "Invalid email server url (email.smtp.server)", 1, 256),
                    "user": validateString(obj.email.smtp.user, "Invalid email server username (email.smtp.user)", 1, 256)
                },
                "content": {
                    "reset": {
                        "subject": validateString(obj.email.content.reset.subject, "Invalid reset email subject (email.content.reset.subject)", 1, 128),
                        "text": validateString(obj.email.content.reset.text, "Invalid reset email text (email.content.reset.text)", 1, 1024),
                        "html": validateString(obj.email.content.reset.html, "Invalid reset email html (email.content.reset.html)", 1, 2048)
                    },
                    "register": {
                        "subject": validateString(obj.email.content.register.subject, "Invalid register email subject (email.content.register.subject)", 1, 128),
                        "text": validateString(obj.email.content.register.text, "Invalid register email text (email.content.register.text)", 1, 1024),
                        "html": validateString(obj.email.content.register.html, "Invalid register email html (email.content.register.html)", 1, 2048)
                    }
                }
            };

            if(typeof obj.session !== "object" || Array.isArray(obj.session)) {
                throw new Error("Invalid session options");
            }

            this.session = {
                "secret": validateString(obj.session.secret, "Invalid session secret (session.secret)", 4, 256),
                "age": validateInteger(obj.session.age, "Invalid session age (session.age) [60000,...]", 60000, Number.MAX_SAFE_INTEGER)
            }

            this.games_per_page = validateInteger(obj.games_per_page, "Invalid games per page (games_per_page)", 5, 200);

            this.search_results_max = validateInteger(obj.search_results_max, "Invalid max search results (search_results_max) [1-100]", 1, 100);

            if(typeof obj.ipblock !== "object" || Array.isArray(obj.ipblock) || 
                typeof obj.ipblock.login !== "object" || Array.isArray(obj.ipblock.login) || 
                typeof obj.ipblock.register !== "object" || Array.isArray(obj.ipblock.register) || 
                typeof obj.ipblock.reset !== "object" || Array.isArray(obj.ipblock.reset) || 
                typeof obj.ipblock.data !== "object" || Array.isArray(obj.ipblock.data) || 
                typeof obj.ipblock.addgame !== "object" || Array.isArray(obj.ipblock.addgame)) {
                throw new Error("Invalid ipblock options");
            }

            this.ipblock = {
                "login": {
                    "max": validateInteger(obj.ipblock.login.max, "Invalid ipblock login max (ipblock.login.max) [1, 1000]", 1, 1000),
                    "minutes": validateInteger(obj.ipblock.login.minutes, "Invalid ipblock login minutes (ipblock.login.minutes) [1, 100000]", 1, 100000)
                },
                "register": {
                    "max": validateInteger(obj.ipblock.register.max, "Invalid ipblock register max (ipblock.register.max) [1, 1000]", 1, 1000),
                    "minutes": validateInteger(obj.ipblock.register.minutes, "Invalid ipblock register minutes (ipblock.register.minutes) [1, 100000]", 1, 100000)
                },
                "reset": {
                    "max": validateInteger(obj.ipblock.reset.max, "Invalid ipblock reset max (ipblock.reset.max) [1, 1000]", 1, 1000),
                    "minutes": validateInteger(obj.ipblock.reset.minutes, "Invalid ipblock reset minutes (ipblock.reset.minutes) [1, 100000]", 1, 100000)
                },
                "data": {
                    "max": validateInteger(obj.ipblock.data.max, "Invalid ipblock data max (ipblock.data.max) [1, 1000]", 1, 1000),
                    "minutes": validateInteger(obj.ipblock.data.minutes, "Invalid ipblock data minutes (ipblock.data.minutes) [1, 100000]", 1, 100000)
                },
                "addgame": {
                    "max": validateInteger(obj.ipblock.addgame.max, "Invalid ipblock addgame max (ipblock.addgame.max) [1, 1000]", 1, 1000),
                    "minutes": validateInteger(obj.ipblock.addgame.minutes, "Invalid ipblock addgame minutes (ipblock.addgame.minutes) [1, 100000]", 1, 100000)
                }
            };

            if(typeof obj.vote_weight !== "object" || Array.isArray(obj.vote_weight) ||
                typeof obj.vote_weight.linear !== "object" || Array.isArray(obj.vote_weight.linear)) {
                throw new Error("Invalid vote_weight options");
            }

            this.vote_weight = {
                "linear" : {
                    "votes_per_user": validateInteger(obj.vote_weight.linear.votes_per_user, "Invalid vote_weight.linear.votes_per_user [1, 1000]", 1, 1000),
                    "max_weight": validateInteger(obj.vote_weight.linear.max_weight, "Invalid vote_weight.linear.max_weight [1, 100000]", 1, 100000)
                }
            };

            if(typeof obj.crypto !== "object" || Array.isArray(obj.crypto)) {
                throw new Error("Invalid crypto options");
            }

            this.crypto = {
                "email_hash": validateString(obj.crypto.email_hash, "Invalid email hash function (crypto.email_hash)", 1, 128),
                "ip_hash": validateString(obj.crypto.ip_hash, "Invalid ip hash function (crypto.ip_hash)", 1, 128),
                "token_bytes": validateInteger(obj.crypto.token_bytes, "Invalid token bytes number (crypto.token_bytes) [4, 256]", 4, 256),
                "salt_bytes": validateInteger(obj.crypto.salt_bytes, "Invalid salt bytes number (crypto.salt_bytes) [4, 256]", 4, 256),
                "key_length": validateInteger(obj.crypto.key_length, "Invalid key length (crypto.key_length) [16, 1024]", 16, 1024)
            };

        } catch(err: unknown) {
            const reason = err instanceof Error ? err.message : "Unknown reason";
            throw new Error("Failed to read config file \"" + filename + "\": " + reason);
        }
    }
}