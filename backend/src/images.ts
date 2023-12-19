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
import { imageSize } from "image-size";
import { default as imageType } from 'image-type';
import { Logger } from "winston";
import { ImageBuffer } from "./types.js";
import { Mutex } from "./help.js";
import { LoggedError } from "./exceptions.js";

/**
 * Simple image downloader
 */
export class ImageDownloader {
    private log: Logger;
    private user_agents = [
        "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:65.0) Gecko/20100101 Firefox/65.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ];
    private cur_user_agent = 0;
    private timestamp = 0;
    /**
     * Wait milliseconds between requests
     */
    private waittime = 200;
    private lock = new Mutex();

    constructor(log: Logger) {
        this.log = log;
    }

    /**
     * Get image data from url
     * 
     * @param url Image URL
     * @returns ImageBuffer
     */
    public async get(url: string): Promise<ImageBuffer> {
        try {
            // Cylce through user agents
            const user_agent = this.user_agents[this.cur_user_agent++];
            if(this.cur_user_agent >= this.user_agents.length) {
                this.cur_user_agent = 0;
            }

            const done = await this.wait();
            const ret = await axios({
                "url": url,
                "method": "get",
                "responseType": "arraybuffer",
                "responseEncoding": "binary",
                "headers": { "User-Agent": user_agent },
                "timeout": 2000
            });
            done();
        
            if(ret.status !== 200) {
                throw new Error("HTTP response code = " + ret.status);
            }
        
            const buffer = ret.data as Buffer;
        
            const size = imageSize(buffer);
            if(!(size.width && size.height)) {
                throw new Error("Failed to detect size");
            }

            const type = await imageType(buffer);
            if(!type) {
                throw new Error("Failed to detect mime");
            }
        
            return {
                "data": buffer,
                "mime": type.mime,
                "width": size.width,
                "height": size.height
            }
        } catch(err) {
            if(err instanceof Error) {
                this.log.error("Failed to download \"" + url + "\": " + err.message);
            } else {
                this.log.error("Failed to download \"" + url + "\"", err);
            }
            throw new LoggedError();
        }
    }

    /**
     * Limit traffic to mobygames.com
     */
    private async wait() {
        // Might not be neccessary but allow only one download at a time
        const {promise, resolve} = this.lock.wait();
        await promise;
        const now = Date.now();
        const elapsed = now - this.timestamp;
        if(elapsed < this.waittime) {
            await this.delay(this.waittime - elapsed)
        }
        this.timestamp = Date.now();
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
