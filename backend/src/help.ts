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

import { Gender, VoterGroup, GameInfo } from "./types";
import axios from "axios";
import sharp from "sharp";
import { InputError } from "./exceptions";
import nodemailer from "nodemailer";
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
 * Get thumbnail from image url
 * @param url URL of image
 * @returns String of thumbnail data
 * @throws
 */
async function getImageThumbnail(url: string): Promise<string> {
    const ret = await axios({
        "url": url,
        "method": "get",
        "responseType": "arraybuffer",
        "responseEncoding": "binary"
    });

    if(ret.status !== 200) {
        throw new Error("Failed to download image");
    }

    const buffer = await sharp(ret.data as Buffer).resize(32, 32).jpeg({ force: true, quality: 90}).toBuffer();

    return "data:image/jpeg;base64," + buffer.toString("base64");
}

/**
 * Get information about game from mobygames.com
 * @param game_id Mobygames.com game id
 * @returns GameInfo
 * @throws
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

    if(Array.isArray(info.genres)) {
        for(const genre of info.genres) {
            if(typeof genre.genre_name === "string" && genre.genre_name.length > 0) {
                game.genres.push(genre.genre_name);
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
                game.icon = await getImageThumbnail(thumb_url);
            } catch(err) {
                console.error(err);
            }
        }
    }

    return game;
}

/**
 * Send account verification email to user
 * @param email Email address
 * @param token Token string
 * @throws
 */
export async function sendVerificationEmail(email: string, token: string) {

    const url = config.base_url + "/validate?token=" + token;

    const transporter = nodemailer.createTransport({
        "host": config.email.server,
        "port": config.email.port,
        "secure": false,
        "auth": {
            "user": config.email.user,
            "pass": config.email.password,
        },
    });
  
    await transporter.sendMail({
        "from": config.email.address,
        "to": email,
        "subject": "Wasted Top1000 Accountverifizierung",
        "text": "Um deinen Account bei Wasted Top1000 freizuschalten, klicke bitte auf folgenden Link: " + url,
        "html": "Hi,<br><br>um deinen Account bei Wasted Top1000 freizuschalten, klicke bitte auf folgenden <a href=\"" + url + "\">Link</a>.<br><br>Schöne Grüße!"
    });
}