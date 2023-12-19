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

import { JSONObject } from "./types.js";

/**
 * Check if object could be valid json
 * 
 * @param o Javascript object
 * @returns true if o is valid
 */
function isJSONObject(o: object): boolean {
    for(const [key, value] of Object.entries(o)) {
        if(typeof key !== "string" || key.length === 0) {
            return false;
        }
        switch(typeof value) {
            case "bigint": case "function": case "symbol": case "undefined": {
                return false;
            }
            case "object": {
                if(value === null) {
                    return false;
                }
                if(Array.isArray(value)) {
                    for(const a of value) {
                        if(!isJSONObject(a)) {
                            return false;
                        }
                    }
                } else {
                    if(!isJSONObject(value)) {
                        return false;
                    }
                }
                break;
            }
        }
    }
    return true;
}

/**
 * Check if variable could be valid json object
 * 
 * @param o Unknown input
 * @returns if input is valid
 */
export function isJSON(o: unknown): o is JSONObject {
    if(typeof o !== "object" || o === null) {
        return false;
    }
    return isJSONObject(o);
}

/**
 * Simple "mutex" to restrict async functions
 */
export class Mutex {
    private promises: Promise<void>[] = [];

    public wait(): {"promise": Promise<void>, "resolve": () => void} {
        let p;
        if(this.promises.length > 0) {
            p = this.promises[this.promises.length - 1];
        }
        let res = () => {};
        this.promises.push(new Promise(resolve => {
            res = resolve;
        }));

        return {
            "promise": p ? p : Promise.resolve(),
            "resolve": () => {
                this.promises.shift();
                res();
            }
        };
    }
}
