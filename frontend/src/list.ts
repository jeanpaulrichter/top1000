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

import { FilterOptions } from "./list/types.js";
import { setFocus } from "./list/focus.js";
import { getListData, getFilterOptions, getPlatformString, findGame, htmlEncode, isMobileBrowser } from "./list/help.js";
import { loadCharts } from "./list/charts.js";

// tell typescript of bootstrap :)
declare global {
    interface Window {
        bootstrap: {
            Tooltip: new(el: Element) => unknown;
        },
        Chart: new(el: Element, options: unknown) => { destroy(): void }
    }
}

/* ------------------------------------------------------------------------------------------------------------------------------------------ */

/**
 * Load a page of the list from the server and display it
 * @param page Page number
 * @param filter Filter options
 */
async function loadList(page: number, filter: FilterOptions) {
    
    const el_games = document.getElementById("games") as HTMLDivElement;
    const el_message = document.getElementById("message") as HTMLDivElement;
    const el_mask = document.getElementById("mask") as HTMLDivElement;

    // Show mask to stop user from clicking stuff
    el_mask.classList.remove("hidden");

    try {
        // HTML template for list entries
        const el_template = document.getElementById("tml_game") as HTMLTemplateElement;

        // Get list data by ajax
        const ret = await getListData(page, filter);
        const data = ret.data;

        // Is this script running on mobile browser?
        const isMobile = isMobileBrowser();

        // Create new list entries and save them in array
        const game_elements = [];
        for(let i = 0; i < data.length; i++) {
            const game = data[i].game;
            const game_number = (page - 1) * ret.limit + (i + 1);
            // Clone template
            const el_game = el_template.content.cloneNode(true) as HTMLDivElement;

            // Setup game head
            const el_head = el_game.querySelector(".game__head") as HTMLElement;
            const el_rank = el_head.querySelector(".game__rank") as HTMLElement;
            const el_title = el_head.querySelector(".game__title") as HTMLElement;
            const el_icon = el_head.querySelector("img") as HTMLImageElement;
            
            el_rank.innerHTML = `${game_number}.`;
            if(game.icon !== undefined && game.icon.length > 0) {                
                el_icon.src = "data:image/webp;base64," + game.icon;
            } else {
                el_icon.src = "images/icon_missing.png";
            }
            el_title.innerHTML = game.title;
            el_head.addEventListener("click", onClickGameHead);

            // Setup body
            const el_body = el_game.querySelector(".game__body") as HTMLElement;
            const el_link = el_body.querySelector("a.game__link") as HTMLLinkElement;
            const el_screen = el_body.querySelector("div.game__screenshots") as HTMLDivElement;
            const el_platforms = el_body.querySelector(".game__platforms") as HTMLElement;
            const el_votes = el_body.querySelector(".game__votes") as HTMLElement;
            const el_score = el_body.querySelector(".game__score") as HTMLElement;
            const el_comments = el_body.querySelector(".game__comments") as HTMLElement;

            if(isMobile || game.screenshots.length === 0) {
                // Limit download size: Only one image from own database

                const el_img = document.createElement("IMG") as HTMLImageElement;
                el_img.src = "image/" + game.id;
                el_img.className = "img--visible";
                el_screen.appendChild(el_img);
            } else {
                // Download size not an issue: Up to three screenshots from mobygames.com

                for(let ii = 0; ii < game.screenshots.length && ii < 3; ii++) {
                    const el_img = document.createElement("IMG") as HTMLImageElement;
                    el_img.src = game.screenshots[ii];
                    if(ii === 0) {
                        el_img.className = "img--visible";
                    }
                    el_screen.appendChild(el_img);
                }
            }

            // Set game information
            el_link.href = game.moby_url;
            el_platforms.innerHTML = getPlatformString(game.platforms);
            el_votes.innerHTML = data[i].votes.toString();
            el_score.innerHTML = data[i].score.toFixed(3).toString();
            if(Array.isArray(data[i].comments) && data[i].comments.length > 0) {
                let comments_str = "";
                for(let ii = 0; ii < data[i].comments.length; ii++) {
                    comments_str += "<p>&ndash; " + htmlEncode(data[i].comments[ii]) + "</p>";
                }
                el_comments.innerHTML = comments_str;
            }

            game_elements.push(el_game);
        }

        // Add new game elements to DOM
        el_games.className = "";
        el_games.replaceChildren(...game_elements);
        
        // Set message (in)visible
        const el_btn_statistic = document.getElementById("btnStatistics") as HTMLButtonElement;
        if(data.length > 0) {
            el_message.className = "hidden";
            el_btn_statistic.disabled = false;
        } else {
            el_message.className = "";
            el_message.innerHTML = "Keine Spiele gefunden :(";
            el_btn_statistic.disabled = true;            
        }

        // Create new page buttons
        setupPages(ret.pages, page);

    } catch(exc) {
        el_games.className = "hidden";
        el_message.className = "";
        el_message.innerHTML = "Es ist ein Fehler aufgetreten :(";
        console.error(exc);
    } finally {
        el_mask.classList.add("hidden");
    }
}

/**
 * Setup pages buttons
 * @param pages Number of pages
 * @param current Current page
 */
function setupPages(pages: number, current: number) {
    const el_pages = document.getElementById("pages") as HTMLDivElement;

    // Remove not needed buttons
    while(el_pages.children.length > pages && el_pages.lastElementChild !== null) {
        el_pages.removeChild(el_pages.lastElementChild);
    }

    // Create needed buttons
    while(el_pages.children.length < pages && el_pages.children.length < 300) {
        const el_btn = document.createElement("BUTTON") as HTMLButtonElement;
        const page = el_pages.children.length + 1;
        const page_str = page.toString();
        el_btn.innerHTML = page_str;
        el_btn.dataset.page = page_str;
        el_btn.addEventListener("click", onClickPage);
        el_pages.appendChild(el_btn);
    }

    // Set current button
    for(let i = 0; i < el_pages.children.length; i++) {
        const el_btn = el_pages.children[i] as HTMLButtonElement;
        if(i === current - 1) {
            el_btn.className = "page--current";
            el_btn.disabled = true;
        } else {
            el_btn.className = "";
            el_btn.disabled = false;
        }
    }
}

/**
 * Change visible game screenshots
 */
function changeImages() {
    // Find game in focus
    const el_games = document.getElementById("games") as HTMLDivElement;
    for(let i = 0; i < el_games.children.length; i++) {
        if(el_games.children[i].classList.contains("game--focus")) {
            const el_screens = el_games.children[i].querySelector("div.game__screenshots");
            if(el_screens !== null && el_screens.children.length > 1) {
                // If more than one screenshot: Set next visible
                let next = 0;
                for(let ii = 0; ii < el_screens.children.length; ii++) {
                    if(el_screens.children[ii].className === "img--visible") {
                        next = ii + 1;
                        el_screens.children[ii].className = "";
                        break;
                    }
                }
                if(next >= el_screens.children.length) {
                    next = 0;
                }
                el_screens.children[next].className = "img--visible";
            }
            break;
        }        
    }
}

/* ------------------------------------------------------------------------------------------------------------------------------------------ */
/* Event handlers */

/**
 * Window load event
 */
function onLoad() {
    // Setup event listener
    const el_btn_filter = document.getElementById("filterToggle") as HTMLButtonElement;
    const el_select_gender = document.getElementById("filterGender") as HTMLSelectElement;
    const el_select_age = document.getElementById("filterAge") as HTMLSelectElement;
    const el_groups = document.querySelectorAll<HTMLInputElement>("#filterGroups input");

    el_btn_filter.addEventListener("click", onClickFilterToggle);
    el_select_gender.addEventListener("change", onChangeFilter);    
    el_select_age.addEventListener("change", onChangeFilter);
    for(const el_radio of el_groups) {
        el_radio.addEventListener("change", onChangeFilter);
    }

    // Setup tooltips
    const el_menu = document.getElementById("menu") as HTMLElement;
    for(const el_tooltip of el_menu.querySelectorAll("button")) {
        new window.bootstrap.Tooltip(el_tooltip);
    }

    const filter = getFilterOptions();

    // Load first page of list
    loadList(1, filter);

    // Load statistics charts
    loadCharts(filter);

    // Change screenshots every 6 seconds
    setInterval(changeImages, 6000);
}

/**
 * Click event handler for heads of list entries
 * @param e Event
 */
function onClickGameHead(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    if(e.target !== null) {
        const el_game = findGame(e.target as HTMLElement) as HTMLElement;
        const focus = !el_game.classList.contains("game--focus");
        setFocus(el_game, focus);
    }
}

/**
 * Click event handler for pages buttons
 * @param this Page button
 */
function onClickPage(this: HTMLButtonElement) {
    if(this.dataset.page !== undefined) {
        loadList(parseInt(this.dataset.page), getFilterOptions());
    }
}

/**
 * Click event handler for toggle filter button
 * @param this Toggle filter button
 */
function onClickFilterToggle(this: HTMLButtonElement) {
    const el_filter = document.getElementById("filter") as HTMLDivElement;
    // Hide/Show filter controls
    if(el_filter.classList.contains("hidden")) {
        el_filter.classList.remove("hidden");
        this.classList.add("icon-menu-open");
        this.classList.remove("icon-menu");
    } else {
        el_filter.classList.add("hidden");
        this.classList.remove("icon-menu-open");
        this.classList.add("icon-menu");
    }
}

/**
 * OnChange handler for filter control elements
 */
function onChangeFilter() {
    const filter = getFilterOptions();
    loadList(1, filter);
    loadCharts(filter);
}

/* ------------------------------------------------------------------------------------------------------------------------------------------ */

window.addEventListener("load", onLoad);

