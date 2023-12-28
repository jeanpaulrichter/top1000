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

import { default as axios } from "redaxios";
import { Modal, Tooltip } from "bootstrap";
import { ListElements, FilterOptions, Game, ListData, GameChartOptions } from "./types.js";
import { ChartManager } from "charts.js";
import { AccordionManager } from "accordion.js";

/**
 * Mangages list.html
 */
class ListHandler {
    /**
     * Important elements
     */
    private el: ListElements;
    /**
     * Current filter options
     */
    private filter: FilterOptions;
    /**
     * Game list accordion manager
     */
    private accordion: AccordionManager;
    /**
     * ChartManager instance
     */
    private chartmanager: ChartManager;
    /**
     * Array of all tooltips
     */
    private tooltips: Tooltip[] = [];
    /**
     * Bootstrap modal dialog for statistics charts
     */
    private dlg_statistics: Modal;
    /**
     * Options for game category statistics charts
     */
    private static charts: GameChartOptions[] = [
        { "category": "genres", "title": "Genres", "id": "chart_genre", "type": "pie" },
        { "category": "gameplay", "title": "Gameplay", "id": "chart_gameplay", "type": "bar" },
        { "category": "perspectives", "title": "Perspektiven", "id": "chart_perspectives", "type": "doughnut" },
        { "category": "settings", "title": "Setting", "id": "chart_settings", "type": "bar" },
        { "category": "topics", "title": "Topics", "id": "chart_topics", "type": "pie" },
        { "category": "platforms", "title": "Platformen", "id": "chart_platforms", "type": "bar", "whitelist": [
            "Game Boy", "PlayStation", "PlayStation 2", "PlayStation 3", "PlayStation 4", "PlayStation 5", "Wii", "SNES",
            "Xbox", "Xbox 360", "Xbox One", "DOS", "Atari ST", "Commodore 64", "Amiga", "Wii U", "SEGA Saturn", "SEGA Master System",
            "PSP", "Nintendo Switch", "Windows"
        ] },
        { "category": "decades", "title": "Jahrzehnte", "id": "chart_years", "type": "bar", "horizontal": true }
    ];
    /**
     * Regex chain to encode user comments
     */
    private static regex_comments = [
        [/&/g, "&amp;"],
        [/</g, "&lt;"],
        [/>/g, "&gt;"],
        [/\*\*([^\s].*?)(?<!\s)\*\*/g, "<b>$1</b>"],
        [/\*([^\s].*?)(?<!\s)\*/g, "<i>$1</i>"],
        [/_([^\s].*?)(?<!\s)_/g, "<u>$1</u>"],
        [/\n/, "<br>"]
    ];

    constructor() {
        // Get important elements
        this.el = {
            "mask": document.getElementById("mask") as HTMLDivElement,
            "message": document.getElementById("message") as HTMLDivElement,
            "games": document.getElementById("games") as HTMLDivElement,
            "pages": document.getElementById("pages") as HTMLDivElement,
            "filter": document.getElementById("filter") as HTMLDivElement,
            "filter_gender": document.getElementById("filterGender") as HTMLSelectElement,
            "filter_age": document.getElementById("filterAge") as HTMLSelectElement,
            "filter_groups": [],
            "chart_carousel": document.getElementById("chartCarousel") as HTMLDivElement,
            "chart_title": document.getElementById("statisticsTitle") as HTMLSpanElement,
            "tml_game": document.getElementById("tml_game") as HTMLTemplateElement,
            "btn_filter": document.getElementById("btnFilterToggle") as HTMLButtonElement,
            "btn_statistics": document.getElementById("btnStatistics") as HTMLButtonElement
        }

        // Setup event handler
        const el_groups = document.querySelectorAll<HTMLInputElement>("#filterGroups input");
        for(const el_radio of el_groups) {
            this.el.filter_groups.push(el_radio);
            el_radio.addEventListener("change", this.onChangeFilter);
        }
        this.el.filter_gender.addEventListener("change", this.onChangeFilter);    
        this.el.filter_age.addEventListener("change", this.onChangeFilter);
        this.el.btn_statistics.addEventListener("click", this.onClickStatistics);
        this.el.btn_filter.addEventListener("click", this.onClickFilterToggle);

        // Create statistics dialog
        const el_dlg_statistics = document.getElementById("dlgStatistics") as HTMLElement;
        this.dlg_statistics = new Modal(el_dlg_statistics);
        this.el.chart_carousel.addEventListener("slid.bs.carousel", this.onStatisticsSwitch);

        // Setup tooltips
        const el_menu = document.getElementById("menu") as HTMLElement;
        for(const el_tooltip of el_menu.querySelectorAll("button")) {
            this.tooltips.push(new Tooltip(el_tooltip));
        }

        // Setup ChartManager
        this.chartmanager = new ChartManager();
        for(const info of ListHandler.charts) {
            const el_canvas = document.getElementById(info.id) as HTMLCanvasElement;
            this.chartmanager.add(el_canvas, info.type, info.category, info.title, info.whitelist, info.horizontal);
        }

        // Setup accordion manager
        this.accordion = new AccordionManager();

        // Default filter
        this.filter = {
            "age": 0,
            "gender": "",
            "group": ""
        };
    
        // Load first page of list
        this.load(1);
        this.chartmanager.load(this.filter);
    }

    /**
     * Handle click somewhere in window...
     * 
     * @param el Event target
     */
    public click(el: HTMLElement): void {
        if(!this.isChildOfGame(el)) {
            this.accordion.close();
        }
    }

    /**
     * Update current list filter
     */
    private updateFilter(): void {
        // Gender
        this.filter.gender = this.el.filter_gender.value;

        // Age    
        this.filter.age = parseInt(this.el.filter_age.value);

        // Group
        for(const el_radio of this.el.filter_groups) {
            if(el_radio.checked) {
                this.filter.group = el_radio.value;
                break;
            }
        }
    }

    /**
     * Query api for list data
     * 
     * @param page Page of list to query
     * @returns ListData
     * @throws Error
     */
    private async listRequest(page: number): Promise<ListData> {
        let url = "/api/list?page=" + page;
        if(this.filter.group !== "") {
            url += "&group=" + this.filter.group;
        }
        if(this.filter.gender !== "") {
            url += "&gender=" + this.filter.gender;
        }
        if(this.filter.age > 0) {
            url += "&age=" + this.filter.age;
        }
    
        const ret = await axios.get(url);
        if(ret.status === 200) {
            return ret.data as ListData;
        } else {
            throw new Error(ret.statusText);
        }
    }

    /**
     * Load list page (Async but exception safe)
     * 
     * @param page Page of list to load
     */
    private async load(page: number): Promise<void> {
        try {
            // Show mask to stop user from clicking stuff
            this.el.mask.classList.remove("hidden");

            // Remove selection
            this.accordion.close(true);
    
            // Get list data
            const ret = await this.listRequest(page);
            const data = ret.data;
    
            // Remove not needed game divs
            while(this.el.games.children.length > data.length && this.el.games.lastChild !== null) {
                this.el.games.removeChild(this.el.games.lastChild);
            }

            // Create needed game divs
            while(this.el.games.children.length < data.length && this.el.games.children.length < 1000) {
                this.el.games.appendChild(this.el.tml_game.content.cloneNode(true));
                const el_game = this.el.games.lastElementChild as HTMLDivElement;
                el_game.children[0].addEventListener("click", this.onClickGameHead);
            }

            if(data.length > 0) {
                // Setup and show games list
                for(let i = 0; i < data.length; i++) {
                    const game = data[i].game;
                    const game_number = (page - 1) * ret.limit + (i + 1);
                    this.setupGame(this.el.games.children[i], game, game_number, data[i].votes, data[i].score, data[i].comments);
                }
                this.el.message.className = "hidden";
                this.el.btn_statistics.disabled = false;

                this.el.pages.classList.remove("hidden");
                this.setupPages(ret.pages, page);
            } else {
                // No games to show
                this.el.message.className = "";
                this.el.message.innerHTML = "Keine Spiele gefunden :(";
                this.el.btn_statistics.disabled = true;
                this.el.pages.classList.add("hidden");
            }
    
        } catch(exc) {
            this.el.games.className = "hidden";
            this.el.message.className = "";
            this.el.message.innerHTML = "Es ist ein Fehler aufgetreten :(";
            this.el.pages.classList.add("hidden");
            console.error(exc);
        } finally {
            this.el.mask.classList.add("hidden");
        }
    }

    /**
     * Setup game div
     * 
     * @param el_game Game div
     * @param game Game data
     * @param rank Game rank
     * @param votes Game votes
     * @param score Game score
     * @param comments Game comments
     */
    private setupGame(el_game: Element, game: Game, rank: number, votes: number, score: number, comments: string[]): void {
        const el_head = el_game.children[0];
        const el_body = el_game.children[1];
        const el_table = el_body.children[0].children[1].children[0];

        // Rank
        const el_rank = el_head.children[0].children[0] as HTMLSpanElement;
        el_rank.innerHTML = `${rank}.`;

        // Icon 
        const el_icon = el_head.children[1].children[0] as HTMLImageElement;
        if(game.icon.length > 0) {                
            el_icon.src = "data:image/webp;base64," + game.icon;
        } else {
            el_icon.src = "images/icon_missing.png";
        }

        // Title
        const el_title = el_head.children[2].children[0] as HTMLSpanElement;
        el_title.innerHTML = game.title;

        // Cover
        const el_cover = el_body.children[0].children[0].children[0] as HTMLImageElement;
        if(game.cover.length > 0) {
            el_cover.src = game.cover;
        } else {
            el_cover.src = "images/nocover.webp"
        }

        // Platforms
        const el_platforms = el_table.children[0].children[1] as HTMLDivElement;
        let platform_str = "";
        for(let i = 0; i < game.platforms.length && i < 5; i++) {
            if(i > 0) {
                platform_str += ", ";
            }
            platform_str += game.platforms[i].name + " (" + game.platforms[i].year + ")";
        }
        if(game.platforms.length > 5) {
            platform_str += "...";
        }
        el_platforms.innerHTML = platform_str;

        // Link
        const el_link = el_table.children[1].children[1].children[0] as HTMLLinkElement;
        el_link.href = "https://www.mobygames.com/game/" + game.moby_id;

        // Votes
        const el_votes = el_table.children[2].children[1] as HTMLDivElement;
        el_votes.innerHTML = votes.toString();

        // Score
        const el_score = el_table.children[3].children[1] as HTMLDivElement;
        el_score.innerHTML = score.toFixed(3).toString();

        // Screenshot
        const el_screenshot = el_table.children[4].children[0].children[0] as HTMLImageElement;
        el_screenshot.src = game.screenshot;

        // Description
        const el_description = el_table.children[4].children[1] as HTMLDivElement;
        el_description.innerHTML = game.description;

        // Comments
        const el_comments = el_body.children[1].children[0] as HTMLDivElement;
        this.setupComments(el_comments, comments);
    }

    /**
     * Setup comments div of game div
     * 
     * @param el_comments Comments div
     * @param comments Comments array
     */
    private setupComments(el_comments: HTMLElement, comments: string[]): void {
        // Remove not needed comment list entries
        while(el_comments.children.length > comments.length && el_comments.lastChild !== null) {
            el_comments.removeChild(el_comments.lastChild);
        }

        // Create needed comment list entries
        while(el_comments.children.length < comments.length && el_comments.children.length < 20) {
            el_comments.appendChild(document.createElement("LI"));
        }

        for(let i = 0; i < comments.length; i++) {
            // encode & set comment
            let s = comments[i];
            for(const regex of ListHandler.regex_comments) {
                s = s.replace(regex[0], regex[1] as string);
            }
            el_comments.children[i].innerHTML = s;
        }
    }

    /**
     * Setup pages div (pagination buttons)
     * 
     * @param pages Overall number of pages
     * @param current Current page number
     */
    private setupPages(pages: number, current: number): void {
        // Remove not needed buttons
        while(this.el.pages.children.length > pages && this.el.pages.lastElementChild !== null) {
            this.el.pages.removeChild(this.el.pages.lastElementChild);
        }
    
        // Create needed buttons
        while(this.el.pages.children.length < pages && this.el.pages.children.length < 500) {
            const el_btn = document.createElement("BUTTON") as HTMLButtonElement;
            const page = this.el.pages.children.length + 1;
            const page_str = page.toString();
            el_btn.innerHTML = page_str;
            el_btn.dataset.page = page_str;
            el_btn.addEventListener("click", this.onClickPage);
            this.el.pages.appendChild(el_btn);
        }
    
        // Set current button
        for(let i = 0; i < this.el.pages.children.length; i++) {
            const el_btn = this.el.pages.children[i] as HTMLButtonElement;
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
     * Hide all tooltips
     */
    private hideTooltips(): void {
        for(const tooltip of this.tooltips) {
            tooltip.hide();
        }
    }

    /**
     * Get game div HTMLElement is part of
     * 
     * @param e HTMLElement
     * @returns Game div or undefined if HTMLElement is not part of any game div
     */
    private isChildOfGame(e: HTMLElement): HTMLElement | undefined {
        while(!e.classList.contains("game") && e.parentElement !== null) {
            e = e.parentElement;
        }
        if(e.classList.contains("game")) {
            return e;
        } else {
            return undefined;
        }
    }

    /**
     * Event handler for any change to filter controls
     */
    private onChangeFilter = () => {
        this.updateFilter();
        this.load(1);
        this.chartmanager.load(this.filter);
    }

    /**
     * "click" event handler for filter toggle button
     */
    private onClickFilterToggle = () => {
        this.hideTooltips();
        if(this.el.filter.classList.contains("hidden")) {
            this.el.filter.classList.remove("hidden");
            this.el.btn_filter.classList.add("icon-menu-open");
            this.el.btn_filter.classList.remove("icon-menu");
        } else {
            this.el.filter.classList.add("hidden");
            this.el.btn_filter.classList.remove("icon-menu-open");
            this.el.btn_filter.classList.add("icon-menu");
        }
    }

    /**
     * "click" event handler for statistics dialog button
     */
    private onClickStatistics = () => {
        this.hideTooltips();
        this.dlg_statistics.toggle();
    }

    private onStatisticsSwitch = (e: unknown) => {
        if(typeof e === "object" && e !== null && "to" in e) {
            switch(e.to) {
                case 0:
                    this.el.chart_title.innerText = "Genres";
                    break;
                case 1:
                    this.el.chart_title.innerText = "Gameplay";
                    break;
                case 2:
                    this.el.chart_title.innerText = "Perspektiven";
                    break;
                case 3:
                    this.el.chart_title.innerText = "Settings";
                    break;
                case 4:
                    this.el.chart_title.innerText = "Themen";
                    break;
                case 5:
                    this.el.chart_title.innerText = "Platformen";
                    break;
                case 6:
                    this.el.chart_title.innerText = "Jahrzehnte";
                    break;
            }
        }
    }

    /**
     * "click" event handler for all page buttons
     * 
     * @param evt Event
     */
    private onClickPage = (evt: Event) => {
        if(evt.target instanceof HTMLElement && evt.target.dataset.page !== undefined) {
            this.load(parseInt(evt.target.dataset.page));
        }
    }

    /**
     * "click" event handler for all game div heads
     * 
     * @param evt Event
     */
    private onClickGameHead = (evt: Event) => {
        evt.preventDefault();
        evt.stopPropagation();
        if(evt.target !== null) {
            const el_game = this.isChildOfGame(evt.target as HTMLElement);
            if(el_game !== undefined) {
                this.accordion.toggle(el_game);
            }
        }
    }
}

window.addEventListener("load", () => {
    const x = new ListHandler();
    window.addEventListener("click", e => {
        x.click(e.target as HTMLElement);
    });
});
