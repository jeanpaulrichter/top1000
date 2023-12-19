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

import { findGame } from "./help.js"

// Currently focused/expanded list entry
let current: HTMLElement | undefined = undefined;

/**
 * Window click eventhandler
 * @param e MouseEvent
 */
 function onWindowClick(e: MouseEvent) {
    // Deselect current game when clicking somewhere...
    if(current !== undefined) {
        const el = e.target as HTMLElement;
        const el_game = findGame(el);
        if(el_game === null) {
            setFocus(current, false);
        }
    }
}
window.addEventListener("click", onWindowClick);

/**
 * (De)Focus a game in the list and expand/collapse it
 * @param el game container element
 * @param focus focused?
 * @returns 
 */
export function setFocus(el: HTMLElement, focus: boolean) {
    // Find relevant dom nodes
    const el_body = el.querySelector("div.game__body") as HTMLDivElement;
    const el_icon = el.querySelector("div.game__expand >span") as HTMLSpanElement;

    // Remove focus from game
    if(focus === false) {        
        el.classList.remove("game--focus");
        // Collapse body div
        el_body.classList.add("hidden");
        el_icon.classList.add("icon-expand");
        el_icon.classList.remove("icon-collapse");

        if(el === current) {
            current = undefined;
        }
    // Set focus on game
    } else if(el !== current) {
        el.classList.add("game--focus");
        // Expand body div
        el_body.classList.remove("hidden");
        el_icon.classList.remove("icon-expand");
        el_icon.classList.add("icon-collapse");

        if(current !== undefined) {
            // Remove focus from previously focused game
            const el_cur_body = current.querySelector("div.game__body") as HTMLElement;
            const el_cur_icon = current.querySelector("div.game__expand >span") as HTMLSpanElement;

            current.classList.remove("game--focus");
            el_cur_body.classList.add("hidden");
            el_cur_icon.classList.add("icon-expand");
            el_cur_icon.classList.remove("icon-collapse");
        }
        current = el;
    }
}