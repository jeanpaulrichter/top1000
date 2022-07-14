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

import { Gender, VoterGroup, GameInfo, FilterOptions } from "./types";
import axios from "axios";
import sharp from "sharp";
import { InputError } from "./exceptions";
import nodemailer, { SendMailOptions } from "nodemailer";
import config from "./config";

/**
 * Get Gender enum from string
 * @param s Input string
 * @returns Gender enum or undefined
 */
export function getGenderFromString(s: string): Gender | undefined {
    switch(s) {
        case "female":
            return Gender.Female;
        case "male":
            return Gender.Male;
        case "other":
            return Gender.Other;
        default:
            return undefined;
    }
}

/**
 * Get VoterGroup enum from string
 * @param s Input string
 * @returns VoterGroup enum or undefined
 */
export function getVoterGroupFromString(s: string): VoterGroup | undefined {
    switch(s) {
        case "gamer":
            return VoterGroup.Gamer;
        case "journalist":
            return VoterGroup.Journalist;
        case "scientist":
            return VoterGroup.Scientist;
        case "critic":
            return VoterGroup.Critic;
        case "wasted":
            return VoterGroup.Wasted;
        default:
            return undefined;
    }
}

/**
 * Download image
 * @param url URL of image
 * @returns Buffer
 * @throws
 */
async function getImageData(url: string): Promise<Buffer> {
    const ret = await axios({
        "url": url,
        "method": "get",
        "responseType": "arraybuffer",
        "responseEncoding": "binary"
    });

    if(ret.status !== 200) {
        throw new Error("Failed to download image");
    }

    return ret.data as Buffer;
}

/**
 * Get information about game from mobygames.com
 * @param game_id Mobygames.com game id
 * @returns GameInfo
 * @throws InputError, Error
 */
export async function getMobygamesInfo(game_id: number): Promise<GameInfo> {
    const ret = await axios({
        "url": "https://api.mobygames.com/v1/games?format=normal&api_key=" + config.moby_api_key + "&id=" + game_id,
        "method": "get",
        "responseType": "json",
        "headers": { "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:65.0) Gecko/20100101 Firefox/65.0" }
    });

    if(ret.status !== 200) {
        throw new Error(ret.statusText);
    }

    if(!(Array.isArray(ret.data.games) && ret.data.games.length === 1)) {
        throw new InputError("Game not found");
    }
    const info = ret.data.games[0];

    if(typeof info.title !== "string" || info.title.length === 0) {
        throw new Error("Invalid title");
    }
    if(typeof info.moby_url !== "string" || info.moby_url.length === 0) {
        throw new Error("Invalid moby_url");
    }

    const game: GameInfo = {
        "title": info.title,
        "moby_id": game_id,
        "moby_url": info.moby_url,
        "description": (typeof info.description === "string") ? info.description : "",
        "genres": [],
        "gameplay": [],
        "perspectives": [],
        "topics": [],
        "settings": [],
        "platforms": [],
        "screenshots": [],
        "year": 0
    }

    if(Array.isArray(info.sample_screenshots)) {
        for(const screen of info.sample_screenshots) {
            if(typeof screen.image === "string" && screen.image.length > 0) {
                game.screenshots.push(screen.image);
            }
        }
    }

    // Try to download sample image
    if(game.screenshots.length > 0) {
        try {
            const data = await getImageData(game.screenshots[0]);
            game.image = await sharp(data).resize(480).webp({"alphaQuality": 0, "lossless": false, "quality": 80}).toBuffer();
        } catch(err) {
            //
        }
    }

    if(Array.isArray(info.genres)) {
        for(const genre of info.genres) {
            if(typeof genre.genre_category_id === "number" && typeof genre.genre_name === "string") {
                switch(genre.genre_category_id) {
                    case 1: {
                        if(genre.genre_id === 62) {
                            throw new InputError("No DLCs/Addons");
                        } else if(genre.genre_id === 76) {
                            throw new InputError("No Compilations");
                        }
                        game.genres.push(genre.genre_name);
                        break;
                    }
                    case 2:
                        game.perspectives.push(genre.genre_name);
                        break;
                    case 4:
                        game.gameplay.push(genre.genre_name);
                        break;
                    case 8:
                        game.topics.push(genre.genre_name);
                        break;
                    case 10:
                        game.settings.push(genre.genre_name);
                        break;
                }
            }
        }
    }

    const regex_year = /[1-9][0-9]{3}/gi
    let first_year = 9999;
    if(Array.isArray(info.platforms)) {
        for(const platform of info.platforms) {
            if(typeof platform.platform_name === "string" && platform.platform_name.length > 0 && 
            typeof platform.first_release_date === "string" && platform.first_release_date.length > 0) {

                let year = 0;
                const test = platform.first_release_date.match(regex_year);
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
        }
    }
    game.year = first_year;

    if(typeof info.sample_cover === "object" && info.sample_cover !== null) {
        const cover_url = info.sample_cover.image;
        const thumb_url = info.sample_cover.thumbnail_image;
        if(typeof cover_url === "string" && cover_url.length > 0) {
            game.cover_url = cover_url;
        }
        if(typeof thumb_url === "string" && thumb_url.length > 0) {
            game.thumbnail_url = thumb_url;
            try {
                // Try to create icon
                const data = await getImageData(thumb_url);
                const buffer = await sharp(data).resize(32, 32).webp({"alphaQuality": 0, "lossless": false, "quality": 80}).toBuffer();
                game.icon = buffer.toString("base64");
            } catch(err) {
                //
            }
        }
    }

    return game;
}

/**
 * Send email
 * @param options Nodemailer options
 * @throws
 */
export async function sendEmail(options: SendMailOptions) {

    const transporter = nodemailer.createTransport({
        "host": config.email.server,
        "port": config.email.port,
        "secure": false,
        "auth": {
            "user": config.email.user,
            "pass": config.email.password,
        },
        "connectionTimeout": 8000,
        "greetingTimeout": 8000
    });

    options.from = config.email.address,
  
    await transporter.sendMail(options);
}

/**
 * Find game id from mobygames game page
 * @param url Mobygames.com URL
 * @returns Game Id
 * @throws InputError, Error
 */
export async function getMobyIDFromURL(url: string): Promise<number> {
    const test_url = url.match(/^(https:\/\/)?www.mobygames.com\/game\/(([a-z0-9\-_]+\/)?[a-z0-9\-_]+)$/);
    if(test_url === null) {
        throw new InputError("Invalid mobygames url");
    }
    const ret = await axios({
        "url": "https://www.mobygames.com/game/" + test_url[2] + "/contribute",
        "method": "get",
        "responseType": "text",
        "responseEncoding": "utf8"
    });

    if(ret.status !== 200) {
        throw new Error(ret.statusText);
    }
    const html = ret.data as string;
    const test = html.indexOf("new_game_wizard/gameId,");

    if(test === -1) {
        throw new Error("Game ID not found.");
    }

    const str = html.substring(test, test + 40);

    const test_string = str.match(/gameId,([0-9]+)/);
    if(test_string === null) {
        throw new Error("Failed to parse game id.");
    }

    const gameid = parseInt(test_string[1]);
    if(Number.isNaN(gameid)) {
        throw new Error("Failed to parse game id.");
    }
    return gameid;
}

export function getFilterParams(gender: unknown, age: unknown, group: unknown): FilterOptions {
    const options: FilterOptions = {};

    // Validate gender
    if(typeof gender === "string") {
        options.gender = getGenderFromString(gender);
        if(options.gender === undefined) {
            throw new InputError("Invalid gender");
        }
    }

    // Validate age
    if(typeof age === "string") {
        options.age = parseInt(age);
        if(Number.isNaN(options.age) || options.age < 1 || options.age > 9) {
            throw new InputError("Invalid age");
        }
    }

    // Validate group
    if(typeof group === "string") {
        options.group = getVoterGroupFromString(group);
        if(options.group === undefined) {
            throw new InputError("Invalid group");
        }
    }

    return options;
}