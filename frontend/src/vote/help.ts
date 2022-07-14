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

import axios from "../lib/redaxios.min.js";
import { GameInfo } from "./types.js";

/**
 * Find game selector container element by child element
 * @param e Child element of game selector
 * @returns Game selector container
 */
export function findGame(e: HTMLElement): HTMLElement | null {
    while(e.className !== "game" && e.className !== "game game--focus" && e.parentElement !== null) {
        e = e.parentElement;
    }
    if(e.className === "game" || e.className === "game game--focus") {
        return e;
    } else {
        return null;
    }
}

/**
 * Find slide container element by child element
 * @param e Child element of slide container
 * @returns Slide container element
 */
export function findSlide(e: HTMLElement): HTMLElement | null {
    while(e.className !== "slide" && e.parentElement !== null) {
        e = e.parentElement;
    }
    if(e.className === "slide") {
        return e;
    } else {
        return null;
    }
}

/**
 * Check if DOM node is child of select2-container
 * @param e HTML node
 * @returns
 */
export function isChildOfSelect2(e: HTMLElement): boolean {
    while(!e.classList.contains("select2-container") && e.parentElement !== null) {
        e = e.parentElement;
    }
    return (e.parentElement !== null);
}

/**
 * Returns label string for game
 * @param item GameInfo
 * @returns label string
 */
export function getLabel(item: GameInfo): string {
    if(item.text !== undefined) {
        return item.text;
    } else {
        if(item.platforms !== undefined) {
            let platforms = "";
            for(let i = 0; i < item.platforms.length && i < 6; i++) {
                if(i > 0) {
                    platforms += ", ";
                }
                platforms += item.platforms[i].name;
            }
            if(item.platforms.length > 6) {
                platforms += "...";
            }
            return item.title + " (" + item.year + ") [" + platforms + "]";
        } else {
            if(item.year !== 0) {
                return item.title + " (" + item.year + ")";
            } else {
                return item.title;
            }        
        }
    }

}

/**
 * Try to add new mobygames game to database
 * @param moby_url Mobygames.com url
 * @throws Error string 
 */
export async function addGameRequest(moby_url: string) {
    try {
        const ret = await axios.post("/api/addgame", {
            "moby_url": moby_url
        });
        if(ret.status !== 200) {
            throw new Error();
        }
    } catch(exc) {
        if(typeof exc === "object" && exc !== null) {
            const e = exc as { [key: string]: unknown };
            if(e.status === 400 && typeof e.data === "string" && e.data.length > 0) {
                throw e.data;
            } else {
                throw "Es ist ein Fehler aufgetreten";
            }
        } else {
            throw "Verbindung zum Server nicht möglich";
        }
    }
}