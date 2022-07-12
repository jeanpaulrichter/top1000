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

import { SearchResult, GameInfo } from "./types.js";
import { findGame, getLabel } from "./help.js";
import { setFocus } from "./focus.js";
import axios from "../lib/redaxios.min.js";

// Array to save all currently selected game ids
const game_ids: string[] = [];
// Flag if custom eventhandler set
let eventhandler_set = false;

/* ------------------------------------------------------------------------------------------------------------------------------------------ */

export function updateProgress() {
    let votes = 0;
    for(let i = 0; i < game_ids.length; i++) {
        if(game_ids[i].length === 24) {
            votes++;
        }
    }
    const percent = Math.round(votes * 100 / game_ids.length);
    const el_progress = document.getElementById("progress") as HTMLElement;
    el_progress.innerHTML = `${percent}%`;
}

/* ------------------------------------------------------------------------------------------------------------------------------------------ */

/**
 * Returns correct GET request parameter for API autocomplete request
 * @param params QueryOptions from select2
 * @returns 
 */
function select2_api_query(params: Select2.QueryOptions) {
    return {
        "search": params.term,
        "page": params.page !== undefined ? params.page : 1
    }
}

/**
 * Process API request result before showing autocomplete
 * @param data SearchResult
 * @returns processed data
 */
function select2_processResults(data: SearchResult) {
    // Make sure already selected games are not included in autocomplete
    if(Array.isArray(data.results)) {
        data.results = data.results.filter(el => {
            return !game_ids.includes(el.id);
        });
    }
    return data;
}

/**
 * Returns html for autocomplete entry
 * @param data GameInfo
 * @returns 
 */
function select2_template(data: GameInfo | Select2.LoadingData) {
    if((data as Select2.LoadingData).loading === undefined) {
        const item = data as GameInfo;
        const label = getLabel(item);
        const icon = (typeof item.icon === "string" && item.icon.length > 0) ? "data:image/webp;base64," + item.icon : "images/icon_missing.png";

        return $("<div class=\"select2__suggestion\"><img src=\"" + icon + "\"/><span>" + label + "</span></div>");
    } else {
        return "";
    }
}

/**
 * Returns label for selected game
 * @returns label string
 */
function select2_label(data: GameInfo | Select2.LoadingData | Select2.IdTextPair) {
    if(typeof (data as GameInfo).title === "string") {
        return getLabel(data as GameInfo);
    } else {
        return "";
    }
}

/* ------------------------------------------------------------------------------------------------------------------------------------------ */

/**
 * Create new select2 element
 * @param el HTML select element
 */
 export function setupSelect2(el: HTMLSelectElement) {
    if(!eventhandler_set) {
        const doc = $(document);
        doc.on("select2:opening", onSelect2Opening);
        doc.on("select2:open", onSelect2Open);
        doc.on("select2:close", onSelect2Close);
        doc.on("select2:selecting", onSelect2Selecting);
        eventhandler_set = true;
    }

    $(el).select2({
        "ajax": {
            "url": "/api/search",
            "dataType": "json",
            "data": select2_api_query,
            "processResults": select2_processResults
        },
        "templateResult": select2_template,
        "templateSelection": select2_label
    });

    // Increase size of game_ids array
    game_ids.push("");
}

/**
 * Highlight select2 control
 * @param el Original select element
 * @param highlight
 */
export function hightlightSelect2(el: HTMLSelectElement, highlight: boolean) {
    // Find span created by select2 as label for select (maybe better search for span.select2-selection...)
    let el_game_span = el.nextElementSibling as HTMLElement;
    el_game_span = el_game_span.children[0].children[0] as HTMLSpanElement;

    if(highlight) {
        el_game_span.classList.add("select2--highlight");
    } else {
        el_game_span.classList.remove("select2--highlight");
    }
}

/**
 * Set the value of an select2 element
 * @param el DOM select element of select2
 * @param game New value of select2
 */
export function setSelect2Value(el: HTMLSelectElement, game: GameInfo) {
    const game_index = parseInt(el.dataset.index as string);
    const newOption = new Option(getLabel(game), game.id, false, false);
    $(el).html("").append(newOption).trigger("change");
    game_ids[game_index] = game.id;
}

/* ------------------------------------------------------------------------------------------------------------------------------------------ */
/* Event handler */

/**
 * Called before a select2 dropdown is opened
 * @param e 
 */
function onSelect2Opening(e: Event) {
    if(e.target instanceof HTMLElement) {
        e.stopPropagation();
        const el_game = findGame(e.target);
        // Select corresponding game
        if(el_game !== null) {
            setFocus(el_game, true);
        }
    }
}

/**
 * Called when a select2 dropdown was opened
 */
function onSelect2Open() {
    setTimeout(() => {
        // focus current select2 input field
        const x = document.querySelector('.select2-search__field') as HTMLElement;
        if(x !== null) {
            x.focus();
        }
    }, 10);  
}

/**
 * Called when a select2 dropdown was closed
 * @param e Event
 */
function onSelect2Close(e: Event) {
    if(e.target instanceof HTMLElement) {
        const el_game = findGame(e.target);
        // Remove focus from currently selected game
        if(el_game !== null) {
            setFocus(el_game, false);
        }
    }
}

/**
 * Called before select2 selection
 * @param e event (should get rid of any...)
 */
function onSelect2Selecting(e: any) {
    // Stop selection
    e.preventDefault();

    const el_select = e.target as HTMLSelectElement;
    const game = e.params.args.data as GameInfo;
    const game_index = parseInt(el_select.dataset.index as string);

    // Try to save vote and only on success change select2 selection
    axios.post("/api/vote",  {
        "game": game.id,
        "position": el_select.dataset.position
    }).then(() => {
        const newOption = new Option(getLabel(game), game.id, false, false);
        $(el_select).html("").append(newOption).trigger("change").select2("close");
        // Save id of selected game
        game_ids[game_index] = game.id;
        // Remove hightlight from select
        hightlightSelect2(el_select, false);
        updateProgress();
    }).catch(err => {
        console.error(err);
        $(el_select).select2("close");
    });
}