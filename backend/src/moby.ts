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

import { default as axios } from "axios";
import { default as sharp } from "sharp";
import { Logger } from "winston";
import { GameInfo, JSONObject } from "./types.js";
import { ConfigData } from "./config.js";
import { InputError, ParseError, LoggedError } from "./exceptions.js";
import { Mutex, isJSON } from "./help.js";
import { ImageDownloader } from "./images.js";

/**
 * Mobygames.com parser class
 */
export class MobygamesLoader {
    private log: Logger;
    private config: ConfigData;
    private images: ImageDownloader;
    private time = {
        "hour": 0,
        "last": 0,
        "hour_count": 0
    };
    private user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.77",
        "Mozilla/5.0 (X11; CrOS x86_64 8172.45.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.64 Safari/537.36",
        "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:15.0) Gecko/20100101 Firefox/15.0.1",
        "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36"
    ];
    private cur_user_agent = 0;
    private regex_year = /[1-9][0-9]{3}/gi;
    private lock = new Mutex();

    constructor(log: Logger, config: ConfigData, images: ImageDownloader) {
        this.log = log;
        this.config = config;
        this.images = images;
    }

    /**
     * Get info for lots of games
     * 
     * @param offset Page offset (100 per page)
     * @returns GameInfo[]
     * @throws InputError, LoggedError
     */
    public async getGames(offset: number): Promise<GameInfo[]> {
        try {
            const done = await this.wait();
            const ret = await this.getJSON("https://api.mobygames.com/v1/games?format=normal&offset=" + offset + "&api_key=" + this.config.moby_api_key);
            done();

            if(!(Array.isArray(ret.games) && ret.games.length > 0)) {
                throw new InputError("No games found");
            }

            const games: GameInfo[] = [];

            for(const info of ret.games) {
                let cur_game_id = 0;
                try {
                    if(typeof info !== "object" || Array.isArray(info) || typeof info.game_id !== "number") {
                        throw new Error("Unexpected game data");
                    }
                    cur_game_id = info.game_id;
                    const game = await this.parseGame(info, cur_game_id);
                    games.push(game);
                } catch (err) {
                    if(err instanceof ParseError || err instanceof InputError) {
                        this.log.error("Failed to parse game with moby_id = " + cur_game_id + ": " + err.message);
                    } else if(err instanceof Error) {
                        this.log.error("Failed to parse game at offset = " + offset + ": " + err.message);
                    } else {
                        this.log.error(err);
                    }
                }
            }
            
            return games;
        } catch(err: unknown) {
            if(err instanceof InputError || err instanceof LoggedError) {
                throw err;
            }
            this.log.error("getGames() failed: ", err);
            throw new LoggedError();
        }
    }

    /**
     * Get info for specific game
     * 
     * @param game_id Mobygames game id
     * @returns GameInfo
     * @throws InputError, LoggedError
     */
    public async getGame(game_id: number): Promise<GameInfo> {
        try {
            const done = await this.wait();
            const ret = await this.getJSON("https://api.mobygames.com/v1/games?format=normal&api_key=" + this.config.moby_api_key + "&id=" + game_id);
            done();

            if(!(Array.isArray(ret.games) && ret.games.length === 1)) {
                throw new InputError("Game not found");
            }
            const info = ret.games[0];
            if(typeof info !== "object" || Array.isArray(info)) {
                throw new Error("Unexpected game data");
            }

            const game = await this.parseGame(info, game_id);
            

            return game;
        } catch(err: unknown) {
            if(err instanceof InputError) {
                throw err;
            }
            this.log.error("getInfo(" + game_id + ") failed: ", err);
            throw new LoggedError();
        }
    }

    /**
     * Get info about game from mobygames
     * 
     * @param game_id Mobygames id
     * @returns JSON info for game
     * @throws InputError, Error
     */
    private async getJSON(url: string): Promise<JSONObject> {
        // Select user agent
        const user_agent = this.user_agents[this.cur_user_agent++];
        if(this.cur_user_agent >= this.user_agents.length) {
            this.cur_user_agent = 0;
        }

        const ret = await axios({
            "url": url,
            "method": "get",
            "responseType": "json",
            "headers": { "User-Agent": user_agent }
        });
        if(ret.status !== 200) {
            throw new Error(ret.statusText);
        }
        if(!isJSON(ret.data)) {
            throw new Error("Unexpected return value");
        }
        return ret.data;
    }

    private async parseGame(info: JSONObject, game_id: number): Promise<GameInfo> {
        if(!(typeof info.title === "string" && info.title.length > 0)) {
            throw new Error("Invalid title");
        }

        const game: GameInfo = {
            "title": info.title,
            "moby_id": game_id,
            "year": 0,
            "description": this.parseDescription(info),
            "genres": [],
            "gameplay": [],
            "perspectives": [],
            "topics": [],
            "settings": [],
            "platforms": [],
            "icon": "",
            "cover": "",
            "screenshot": ""
        }

        this.parseGenres(game, info);
        this.parseYears(game, info);
        await this.parseImages(game, info);

        return game;
    }

    /**
     * Get short description for game (Without html, shorter than 400 characters)
     * 
     * @param info mobygames game info
     * @returns Description string
     */
    private parseDescription(info: JSONObject): string {
        if(!(typeof info.description === "string" && info.description.length > 0)) {
            return "";
        }
        let s = info.description;

        let tidx = s.indexOf("</p>");
        if(tidx != -1) {
            s = s.substring(0, tidx);
        }
        tidx = s.indexOf("<br");
        if(tidx != -1) {
            s = s.substring(0, tidx);
        }
        s = s.replace(/<.+?>/g, "");
        s = s.replace(/\s+/g, " ");

        if(s.length >= 400) {
            let len = 350;
            tidx = s.indexOf(". ");
            if(tidx !== -1) {
                len = tidx + 1;
                let run = true;
                while(run) {
                    tidx = s.indexOf(". ", len + 1);
                    run = (tidx != -1 && tidx + 1 < 400);
                    if(run) {
                        len = tidx + 1;
                    }
                }
            }
            s = s.substring(0, len);
        }
        return s;
    }

    /**
     * Parse mobygames genre info
     * 
     * @param game game object
     * @param info mobygames game info
     * @throws InputError, ParseError
     */
    private parseGenres(game: GameInfo, info: JSONObject): void {
        const genres = info.genres;
        if(!Array.isArray(genres)) {
            return;
        }

        for(const genre of genres) {
            if(typeof genre !== "object" || Array.isArray(genre) || 
                typeof genre.genre_category_id !== "number" || typeof genre.genre_name !== "string") {
                throw new ParseError("Unexpected genre data");
            }

            switch(genre.genre_category_id) {
                // "Basic Genres"
                case 1: {
                    if(genre.genre_id === 62) {
                        throw new InputError("No DLCs/Addons");
                    } else if(genre.genre_id === 76) {
                        throw new InputError("No Compilations");
                    } else if(genre.genre_id === 187) {
                        throw new InputError("No Special Editions");
                    }
                    game.genres.push(genre.genre_name);
                    break;
                }
                // "Perspective"
                case 2:
                    game.perspectives.push(genre.genre_name);
                    break;
                // "Gameplay"
                case 4:
                    game.gameplay.push(genre.genre_name);
                    break;
                // "Narrative Theme/Topic"
                case 8:
                    game.topics.push(genre.genre_name);
                    break;
                // "Setting"
                case 10:
                    game.settings.push(genre.genre_name);
                    break;
            }
        }
    }

    /**
     * Parse mobygames year/platforms info
     * 
     * @param game game object
     * @param info mobygames game info
     * @throws InputError, ParseError
     */
    private parseYears(game: GameInfo, info: JSONObject): void {
        const platforms = info.platforms;
        if(!Array.isArray(platforms)) {
            return;
        }

        let first_year = 9999;

        for(const platform of platforms) {
            if(typeof platform !== "object" || Array.isArray(platform) || 
                typeof platform.platform_name !== "string" || typeof platform.first_release_date !== "string") {
                throw new ParseError("Unexpected platform data");
            }
            let year = 0;
            
            // Year value on mobygames is not consistent (ie. "04-1988", "1999", ...)
            const test = platform.first_release_date.match(this.regex_year);
            if(test !== null && test.length === 1) {
                year = parseInt(test[0]);
                if(year < first_year) {
                    first_year = year;
                }
            }

            game.platforms.push({
                "name": platform.platform_name,
                "year": year
            });

        }

        if(first_year != 9999) {
            game.year = first_year;
        }
    }

    /**
     * Parse mobygames images info
     * 
     * @param game game object
     * @param info mobygames game info
     * @returns 
     * @throws InputError
     */
    private async parseImages(game: GameInfo, info: JSONObject): Promise<void> {

        // Screenshot
        if(Array.isArray(info.sample_screenshots) && info.sample_screenshots.length > 0) {
            const random_id = Math.floor(Math.random() * (info.sample_screenshots.length - 1));
            const screen = info.sample_screenshots[random_id];
            if(typeof screen === "object" && !Array.isArray(screen) && typeof screen.image == "string" && screen.image.length > 0) {
                game.screenshot = screen.image;
            }
        }

        if(typeof info.sample_cover === "object" && !Array.isArray(info.sample_cover) && 
            typeof info.sample_cover.image === "string" && info.sample_cover.image.length > 0) {
            game.cover = info.sample_cover.image;

            let icon_url = game.cover;
            if(typeof info.sample_cover.thumbnail_image === "string" && info.sample_cover.thumbnail_image.length > 0) {
                icon_url = info.sample_cover.thumbnail_image;
            }

            try {
                // Try to create icon
                const image = await this.images.get(icon_url);
                const buffer = await sharp(image.data).resize(32, 32).webp({"alphaQuality": 0, "lossless": false, "quality": 80}).toBuffer();
                game.icon = buffer.toString("base64");
            } catch(err) {
                game.icon = "";
                this.log.error("Failed to create icon for mobygames id: " + game.moby_id);
            }
        }
    }

    /**
     * Make sure to follow mobygames api limit of 360 request per hour and 1 per second
     */
    private async wait() {
        const {promise, resolve} = this.lock.wait();
        await promise;

        let now = Date.now();
        let wait = 0;
        const last = now - this.time.last;
        if(last <= 1000) {
            wait += (last + 100);
        }
        if(this.time.hour_count >= 360) {
            wait += (now - this.time.hour) + 100;
        }
        await this.delay(wait);
        now = Date.now();
        if(now - this.time.hour > 3600000) {
            this.time.hour = now;
            this.time.hour_count = 0;
        }
        this.time.last = now;
        return resolve;
    }

    /**
     * Delay execution for ms milliseconds
     * 
     * @param ms Milliseconds
     * @returns true
     */
    private delay(ms: number): Promise<boolean> {
        return new Promise((resolve) => {
            setTimeout(() => {
                this.log.info("waited for " + ms + "milliseconds");
                resolve(true);
            }, ms);
        });
    }
}
