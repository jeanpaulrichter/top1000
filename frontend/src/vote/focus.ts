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

import { findGame, isChildOfSelect2 } from "./help.js";

let current: HTMLElement | undefined = undefined;

/**
 * Window mouseup eventhandler
 * @param e MouseEvent
 */
function onWindowMouseUp(e: MouseEvent) {
    // Deselect current game when clicking somewhere...
    if(current !== undefined) {
        const el = e.target as HTMLElement;
        if(!isChildOfSelect2(el)) {
            const el_game = findGame(el);
            if((el_game === null || el_game !== current)) {
                setFocus(current, false);
            }
        }
    }
}
window.addEventListener("mouseup", onWindowMouseUp);

/**
 * (De)Focus a game selector
 * @param el game container element
 * @param value selected?
 * @param comment Expand comment area?
 * @returns 
 */
export function setFocus(el: HTMLElement, focus: boolean, expand?: boolean) {
    // Find relevant dom nodes
    const el_div_more = el.querySelector("div.game__body") as HTMLElement;
    const el_btn_expand = el.querySelector("span.game__expand") as HTMLButtonElement;

    // Remove focus from game selector
    if(focus === false) {        
        el.classList.remove("game--focus");
        // Collapse more div
        el_div_more.classList.add("hidden");
        el_btn_expand.classList.add("icon-expand");
        el_btn_expand.classList.remove("icon-collapse");

        if(el === current) {
            current = undefined;
        }
    // Set focus on game selector
    } else {
        if(expand === true && el_div_more.classList.contains("hidden")) {
            // Expand more div
            el_div_more.classList.remove("hidden");
            el_btn_expand.classList.remove("icon-expand");
            el_btn_expand.classList.add("icon-collapse");
            const el_textarea = el_div_more.querySelector("textarea") as HTMLElement;
            el_textarea.focus();
        }
        // game selector is not already focused
        if(el !== current) {
            el.classList.add("game--focus");
            if(current !== undefined) {
                // Remove focus from previously focused game selector
                current.classList.remove("game--focus");
                const el_cur_div_more = current.querySelector("div.game__body") as HTMLElement;
                const el_cur_btn_expand = current.querySelector("span.game__expand") as HTMLButtonElement;
                el_cur_div_more.classList.add("hidden");
                el_cur_btn_expand.classList.add("icon-expand");
                el_cur_btn_expand.classList.remove("icon-collapse");
            }
            current = el;
        }
    }
}