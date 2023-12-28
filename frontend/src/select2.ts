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

import { SearchResult, GameInfo, VoteInfo, AutocompleteAPIParam } from "./types.js";
import { default as axios } from "redaxios";

/**
 * Manager of jquery/select2 dropdown elements
 */
export class Select2Manager {
    /**
     * Progress div
     */
    private el_progress: HTMLElement;
    /**
     * Array of selected game ids
     */
    private selected_games: string[] = [];

    constructor() {
        // Setup select2 event handlers
        const doc = $(document);
        doc.on("select2:opening", this.onOpening);
        doc.on("select2:open", this.onOpen);
        doc.on("select2:close", this.onClose);
        doc.on("select2:selecting", this.onSelecting);

        this.el_progress = document.getElementById("progress") as HTMLElement;
    }

    /**
     * Setup new select2 element
     * 
     * @param e HTML select element
     */
    public add(e: HTMLElement): void {
        $(e).select2({
            "ajax": {
                "url": "/api/search",
                "dataType": "json",
                "data": this.apiQuery.bind(this),
                "processResults": this.processResults.bind(this)
            },
            "templateResult": this.templateResult.bind(this),
            "templateSelection": this.templateSelection.bind(this)
        });
        // Increase size of selected games array
        this.selected_games.push("");
    }

    /**
     * Get current user votes from API
     */
    public load(): void {
        axios.get("api/votes").then(ret => {
            const votes = ret.data as VoteInfo[];
            if(Array.isArray(votes)) {
                for(const vote of votes) {
                    const el_select = document.getElementById("game" + vote.position) as HTMLSelectElement;

                    // Set select2 set GameInfo
                    const game_index = parseInt(el_select.dataset.index as string);
                    const newOption = new Option(this.getLabel(vote), vote.id, false, false);
                    $(el_select).html("").append(newOption).trigger("change");
                    this.selected_games[game_index] = vote.id;

                    if(typeof vote.comment === "string" && vote.comment.length > 0) {
                        const el_text = document.getElementById(`game${vote.position}_comment`) as HTMLTextAreaElement;
                        el_text.value = vote.comment;
                    }
                }
            }
            this.updateProgress();
        }).catch(err => {
            console.error(err);
        });
    }

    /**
     * Returns label string for game
     * 
     * @param item GameInfo
     * @returns label string
     */
    private getLabel(item: GameInfo): string {
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
     * Add/remove select2--hightlight class to/from select2
     * 
     * @param el HTML select element
     * @param highlight Highlight select2 yes/no
     */
    private highlight(el: HTMLElement, highlight: boolean): void {
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
     * Update voting progress
     */
    private updateProgress(): void {
        let votes = 0;
        for(let i = 0; i < this.selected_games.length; i++) {
            if(this.selected_games[i].length === 24) {
                votes++;
            }
        }
        const percent = Math.round(votes * 100 / this.selected_games.length);
        this.el_progress.ariaValueNow = percent.toString();
        const el = this.el_progress.firstElementChild as HTMLElement;
        const percent_str = percent.toString() + "%";
        el.style.width = percent_str;
        el.innerHTML = percent_str; 
    }

    /**
     * Add/Remove select2--focus class from game head
     * 
     * @param el HTMLElement
     * @param focus Focus: true/false
     */
    private setFocus(el: HTMLElement, focus: boolean) {
        while(!el.classList.contains("game") && el.parentElement !== null) {
            el = el.parentElement;
        }
        if(el.classList.contains("game")) {
            if(focus) {
                el.children[0].classList.add("select2--focus");
            } else {
                el.children[0].classList.remove("select2--focus");
            }
        }
    }

    /**
     * Returns correct GET request parameter for API autocomplete request
     * 
     * @param params QueryOptions from select2
     * @returns GET request parameter
     */
    private apiQuery(params: Select2.QueryOptions): AutocompleteAPIParam {
        return {
            "search": params.term ? params.term : "",
            "page": params.page !== undefined ? params.page : 1
        }
    }

    /**
     * Filter out already selected games from autocomplete result
     * 
     * @param data SearchResult
     * @returns SearchResult
     */
    private processResults(data: SearchResult): SearchResult {
        if(Array.isArray(data.results)) {
            data.results = data.results.filter(el => {
                return !this.selected_games.includes(el.id);
            });
        }
        return data;
    }

    /**
     * Returns html for autocomplete entry
     * 
     * @param data GameInfo
     * @returns 
     */
    private templateResult(data: GameInfo | Select2.LoadingData) {
        if((data as Select2.LoadingData).loading === undefined) {
            const item = data as GameInfo;
            const label = this.getLabel(item);
            const icon = (typeof item.icon === "string" && item.icon.length > 0) ? "data:image/webp;base64," + item.icon : "images/icon_missing.png";

            return $("<div class=\"select2__suggestion\"><img src=\"" + icon + "\"/><span>" + label + "</span></div>");
        } else {
            return "";
        }
    }

    /**
     * Returns label for selected game
     * 
     * @returns label string
     */
    private templateSelection(data: GameInfo | Select2.LoadingData | Select2.IdTextPair) {
        if(typeof (data as GameInfo).title === "string") {
            return this.getLabel(data as GameInfo);
        } else {
            return "";
        }
    }

    /**
     * Called before a select2 dropdown is opened
     * 
     * @param e Event
     */
    private onOpening = (e: Event) => {
        if(e.target instanceof HTMLElement) {
            e.stopPropagation();
            this.highlight(e.target, true);
            this.setFocus(e.target, true);
        }
    }

    /**
     * Called when a select2 dropdown was opened
     */
    private onOpen = () => {
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
     * 
     * @param e Event
     */
    private onClose = (e: Event) => {
        if(e.target instanceof HTMLElement) {
            this.setFocus(e.target, false);
            this.highlight(e.target, false);
        }
    }

    /**
     * Called before select2 selection
     * 
     * @param e event (should get rid of any...)
     */
    private onSelecting = (evt: Event) => {
        // Stop default selection
        evt.preventDefault();

        if(!(evt.target !== null && "params" in evt && typeof evt.params === "object" && evt.params !== null && 
            "args" in evt.params && typeof evt.params.args === "object" && evt.params.args !== null &&
            "data" in evt.params.args && typeof evt.params.args.data === "object" && evt.params.args.data !== null)) {
            return;
        }
        const el_select = evt.target as HTMLSelectElement;
        const game = evt.params.args.data as GameInfo;
        const game_index = parseInt(el_select.dataset.index as string);

        // Try to save vote and only on success change select2 selection
        axios.post("/api/vote",  {
            "game": game.id,
            "position": el_select.dataset.position
        }).then(() => {

            // Set select2 value
            const newOption = new Option(this.getLabel(game), game.id, false, false);
            $(el_select).html("").append(newOption).trigger("change").select2("close");
            this.selected_games[game_index] = game.id;

            this.updateProgress();
        }).catch(err => {
            console.error(err);
            $(el_select).select2("close");
        });
    }
}
