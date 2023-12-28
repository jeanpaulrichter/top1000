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

import { Tooltip, Modal } from "bootstrap";
import { default as axios } from "redaxios";
import { VoteElements, UserInfo, SlideOptions } from "./vote/types.js";
import { Select2Manager } from "vote/select2.js";
import { AccordionManager } from "accordion.js";

/**
 * Handler for vote page
 */
class VoteHandler {
    /**
     * Important elements in DOM tree
     */
    private el: VoteElements;
    /**
     * Modal help dialog
     */
    private dlg_help: Modal;
    /**
     * Array of all tooltips
     */
    private tooltips: Tooltip[] = [];
    /**
     * Current slide
     */
    private cur_step: number;
    /**
     * Number of slides
     */
    private max_steps: number;
    /**
     * Accordion manager
     */
    private accordion: AccordionManager;
    /**
     * Select2 handler
     */
    private select2: Select2Manager;

    /**
     * Slides with dropdown controls for game selection are dynamiclly created according to this object
     */
    private static slides: SlideOptions[] = [
        {
            "text": "Wähle jetzt deine Top-10 Videospiele aller Zeiten. Wenn du ein Spiel nicht finden kannst, klicke den Hilfe (?) Button rechts oben.",
            "games": 10
        },
        {
            "text": "Wenn du zu einem Spiel einen kurzen Kommentar hinterlassen möchtest, klicke auf den Button rechts neben jeder Zeile.",
            "games": 10
        },
        {
            "text": "Fast geschafft! Nur noch zehn weitere Spiele... ",
            "games": 10
        }
    ];

    constructor() {
        // Find important HTML elements
        this.el = {
            "slides": document.getElementById("slides") as HTMLElement,
            "step": document.getElementById("step") as HTMLDivElement,
            "progress": document.getElementById("progress") as HTMLDivElement,
            "gender": document.getElementById("genderSelect") as HTMLSelectElement,
            "age": document.getElementById("ageSelect") as HTMLSelectElement,
            "group_hobby": document.getElementById("checkGroupHobby") as HTMLInputElement,
            "group_journalist": document.getElementById("checkGroupJournalist") as HTMLInputElement,
            "group_scientist": document.getElementById("checkGroupScientist") as HTMLInputElement,
            "group_critic": document.getElementById("checkGroupCritic") as HTMLInputElement,
            "group_wasted": document.getElementById("radioWasted") as HTMLInputElement,
            "group_notwasted": document.getElementById("radioNotWasted") as HTMLInputElement,
            "btn_next": document.getElementById("btnNextSlide") as HTMLButtonElement,
            "btn_prev": document.getElementById("btnPrevSlide") as HTMLButtonElement,
            "btn_help": document.getElementById("btnHelp") as HTMLButtonElement,
            "btn_addgame": document.getElementById("btnAddGame") as HTMLButtonElement,
            "tml_slide": document.getElementById("tml_slide") as HTMLTemplateElement,
            "tml_game": document.getElementById("tml_game") as HTMLTemplateElement,
            "dlg_help": document.getElementById("dlgHelp") as HTMLDivElement,
            "addgame_url": document.getElementById("helpGameURL") as HTMLInputElement,
            "addgame_msg": document.getElementById("addGameMsg") as HTMLSpanElement
        }

        // Setup accordion manager
        this.accordion = new AccordionManager();

        // Setup select2
        this.select2 = new Select2Manager(this.el.progress, this.setGameFocus.bind(this));

        // Create slides
        this.createSlides();
        this.cur_step = 1;
        this.max_steps = 1 + VoteHandler.slides.length;
        this.updateStep();
        this.select2.load();

        // Setup tooltips
        const el_menu = document.getElementById("menu") as HTMLElement;
        for(const el_tooltip of el_menu.querySelectorAll("button")) {
            this.tooltips.push(new Tooltip(el_tooltip));
        }
        this.tooltips.push(new Tooltip(this.el.progress));

        // Setup help dialog
        this.dlg_help = new Modal(this.el.dlg_help);

        // Setup event handlers
        this.el.gender.addEventListener("change", this.onChangeUserInfo);
        this.el.age.addEventListener("change", this.onChangeUserInfo);
        this.el.group_hobby.addEventListener("change", this.onChangeUserInfo);
        this.el.group_journalist.addEventListener("change", this.onChangeUserInfo);
        this.el.group_scientist.addEventListener("change", this.onChangeUserInfo);
        this.el.group_critic.addEventListener("change", this.onChangeUserInfo);
        this.el.group_wasted.addEventListener("change", this.onChangeUserInfo);
        this.el.group_notwasted.addEventListener("change", this.onChangeUserInfo);
        this.el.btn_next.addEventListener("click", this.onClickNextSlide);
        this.el.btn_prev.addEventListener("click", this.onClickPrevSlide);
        this.el.btn_help.addEventListener("click", this.onClickHelp);
        this.el.btn_addgame.addEventListener("click", this.onClickAddGame);
        this.el.dlg_help.addEventListener("hidden.bs.modal", this.onCloseHelpDialog);
        this.el.dlg_help.addEventListener("shown.bs.modal", this.onOpenHelpDialog);

        // Load current user info
        this.requestUserInfo();
    }

    /**
     * Handle click somewhere in window...
     * 
     * @param el Event target
     */
    public click(el: HTMLElement): void {
        // Ignore clicks in current select2 (is dynamiclly added to body on focus)
        if(document.body.lastElementChild && document.body.lastElementChild.tagName === "SPAN" &&
            document.body.lastElementChild.contains(el)) {
            return;
        }
        // Ignore clicks in currently selected game
        if(!this.isPartofGame(el)) {
            this.accordion.close();
        }
    }

    /**
     * Create slides to select games and add them to DOM
     */
    private createSlides() {
        let game_count = 0;
    
        for(const slide of VoteHandler.slides) {
            // Create new slide
            const new_slide = this.el.tml_slide.content.cloneNode(true) as HTMLElement;

            // Relevant nodes of new slide
            const el_slide_text = new_slide.children[0].children[0].children[0] as HTMLSpanElement;
            const el_slide_games = new_slide.children[0].children[1] as HTMLDivElement;
    
            el_slide_text.innerHTML = slide.text;
    
            // Create game selectors for slide
            for(let i = 0; i < slide.games; i++) {
                const game_index = game_count + i;
                const game_number = game_index + 1;
                const game_name = `game${game_number}`;
    
                // Create new game selector from template
                const new_game = this.el.tml_game.content.cloneNode(true) as HTMLElement;
                // Relevant nodes of new game selector
                const el_game_div = new_game.children[0] as HTMLDivElement;
                const el_game_number = el_game_div.children[0].children[0].children[0] as HTMLSpanElement;
                const el_game_select = el_game_div.children[0].children[1].children[0] as HTMLSelectElement;
                const el_game_btn_expand = el_game_div.children[0].children[2].children[0] as HTMLButtonElement;
                const el_game_textarea = el_game_div.children[1].children[1].children[0] as HTMLTextAreaElement;
    
                // Setup names, ids and eventhandler etc.
                el_game_div.dataset.index = game_index.toString();
                el_game_number.innerHTML = game_number.toString() + ".";
                el_game_btn_expand.addEventListener("click", this.onClickButtonExpand);
                el_game_textarea.id = game_name + "_comment";
                el_game_textarea.name = game_name + "_comment";
                el_game_textarea.addEventListener("blur", this.onGameCommentBlur);
    
                // Setup select2
                el_game_select.name = game_name;
                el_game_select.id = game_name;
                el_game_select.dataset.position = game_number.toString();
                el_game_select.dataset.index = game_index.toString();
                this.select2.add(el_game_select);
    
                // Add game selector to slide
                el_slide_games.appendChild(new_game);
            }
    
            // Append slide to form
            this.el.slides.appendChild(new_slide);
    
            game_count += slide.games;
        }
    }

    /**
     * Update current slide info
     */
    private updateStep() {
        this.el.step.innerHTML = this.cur_step.toString() + "/" + this.max_steps.toString();
        if(this.cur_step == 1) {
            this.el.btn_prev.disabled = true;
        } else {
            this.el.btn_prev.disabled = false;
        }
        if(this.cur_step == this.max_steps) {
            this.el.btn_next.disabled = true;
        } else {
            this.el.btn_next.disabled = false;
        }
    }

    /**
     * Start API request to get current user info
     */
    private requestUserInfo(): void {
        axios.get("api/user").then(ret => {
            const user = ret.data as UserInfo;
            if(user !== undefined && !Array.isArray(user)) {
                this.el.gender.value = user.gender;
                this.el.age.value = user.age.toString();
                this.el.group_hobby.checked = user.gamer;
                this.el.group_journalist.checked = user.journalist;
                this.el.group_scientist.checked = user.scientist;
                this.el.group_critic.checked = user.critic;
                this.el.group_wasted.checked = user.wasted;
                this.el.group_notwasted.checked = !user.wasted;
            }
        }).catch(err => {
            console.error(err);
        });
    }

    /**
     * API request to add new game
     * 
     * @param moby_url Mobygames ID or url
     */
    private async addGameRequest(moby_url: string): Promise<void> {
        try {
            const ret = await axios.post("/api/addgame", {
                "moby_url": moby_url
            });
            if(ret.status !== 200) {
                throw ret.statusText;
            }
        } catch(exc) {
            if(typeof exc === "object" && exc !== null && 
                "status" in exc && exc.status === 40 &&
                "data" in exc && typeof exc.data === "string" && exc.data.length > 0) {
                throw exc.data;
            } else {
                throw "Es ist ein Fehler aufgetreten";
            }
        }
    }

    /**
     * Add/Remove game--selected class from game
     * 
     * @param el HTMLElement
     * @param focus Focus: true/false
     */
    private setGameFocus(el: HTMLElement, focus: boolean) {
        const el_game = this.isPartofGame(el);
        if(el_game !== undefined) {
            if(focus) {
                el_game.children[0].classList.add("select2--focus");
            } else {
                el_game.children[0].classList.remove("select2--focus");
            }
        }
    }

    /**
     * Return game element if e is part of game
     * 
     * @param e HTMLElemnt
     * @returns Game element or undefined
     */
    private isPartofGame(e: HTMLElement): HTMLElement | undefined {
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
     * Hide all tooltips
     */
    private hideTooltips(): void {
        for(const tooltip of this.tooltips) {
            tooltip.hide();
        }
    }

    /**
     * Event handler for any change by user to his gender/age/group
     */
    private onChangeUserInfo = () => {
        const gender = (this.el.gender.value === "") ? undefined : this.el.gender.value;
        const age = this.el.age.value;
        const gamer = (this.el.group_hobby.checked) ? "gamer": undefined;
        const journalist = (this.el.group_journalist.checked) ? "journalist": undefined;
        const scientist = (this.el.group_scientist.checked) ? "scientist": undefined;
        const critic = (this.el.group_critic.checked) ? "critic": undefined;
        const wasted = (this.el.group_wasted.checked) ? "yes": undefined;
    
        axios.post("/api/user", {
            "gender": gender,
            "age": age,
            "gamer": gamer,
            "journalist": journalist,
            "scientist": scientist,
            "critic": critic,
            "wasted": wasted
        }).catch(err => {
            console.error(err);
        });
    }

    /**
     * "click" event handler for next slide button
     */
    private onClickNextSlide = () => {
        if(this.cur_step < this.max_steps) {
            this.el.slides.children[this.cur_step - 1].classList.add("hidden");
            this.el.slides.children[this.cur_step].classList.remove("hidden");
            this.cur_step++;
            this.updateStep();
        }
    }

    /**
     * "click" event handler for previous slide button
     */
    private onClickPrevSlide = () => {
        if(this.cur_step > 1) {
            this.cur_step--;
            this.el.slides.children[this.cur_step].classList.add("hidden");
            this.el.slides.children[this.cur_step - 1].classList.remove("hidden");
            this.updateStep();
        }
    }

    /**
     * "click" event handler for help dialog button
     */
    private onClickHelp = () => {
        this.hideTooltips();
        this.dlg_help.toggle();        
    }

    /**
     * "click" event handler for "add game" button of help dialog
     */
    private onClickAddGame = () => {
        this.el.btn_addgame.disabled = true;
        this.el.addgame_url.disabled = true;
        this.el.addgame_msg.className = "hidden";
    
        // Try to add game to database...
        this.addGameRequest(this.el.addgame_url.value).then(() => {
            this.el.addgame_msg.classList.add("help-dialog__msg--success");
            this.el.addgame_msg.classList.remove("help-dialog__msg--error");
            this.el.addgame_msg.innerHTML = "Spiel hinzugefügt."; 
        }).catch((err: unknown) => {
            this.el.addgame_msg.classList.remove("help-dialog__msg--success");
            this.el.addgame_msg.classList.add("help-dialog__msg--error");
            if(typeof err === "string") {
                this.el.addgame_msg.innerHTML = err;
            } else {
                this.el.addgame_msg.innerHTML = "Hinzufügen fehlgeschlagen";
            }
            console.error(err);
        }).finally(() => {
            this.el.btn_addgame.disabled = false;
            this.el.addgame_url.disabled = false;
        })
    }

    /**
     * Called when help dialog was closed
     */
    private onCloseHelpDialog = () => {
        const el_msg = document.getElementById("addGameMsg") as HTMLDivElement;
        el_msg.className = "hidden";
    }

    /**
     * Called when help dialog is opened
     */
    private onOpenHelpDialog = () => {
        this.el.addgame_url.focus();
    }

    /**
     * "click" event handler for expand game button (to show comment input element)
     * 
     * @param e Event
     */
    private onClickButtonExpand = (e: Event) => {
        if(e.target instanceof HTMLElement) {
            const el_game = this.isPartofGame(e.target);
            if(el_game !== undefined) {
                e.stopPropagation();
                const el_textarea = el_game.children[1].children[1].children[0] as HTMLElement;
                this.accordion.toggle(el_game, el_textarea);
            }
        }
    }

    /**
     * Blur event handler for comment textareas: save comment
     * 
     * @param e Event
     */
    private onGameCommentBlur = (e: Event) => {
        const el_text = e.target as HTMLTextAreaElement;
        const el_game = this.isPartofGame(el_text) as HTMLElement;
        if(el_game !== undefined) {
            const el_select = el_game.children[0].children[1].children[0] as HTMLSelectElement;

            if(el_select.value !== "" && el_text.value !== "") {
                axios.post("/api/comment", {
                    "position": el_select.dataset.position,
                    "comment": el_text.value
                }).then(ret => {
                    if(typeof ret.data === "object" && ret.data !== null && "comment" in ret.data &&
                        typeof ret.data.comment === "string") {
                        el_text.value = ret.data.comment;
                    }
                }).catch(err => {
                    console.error(err);
                });
            }
        }
    }
}

window.addEventListener("load", () => {
    const x = new VoteHandler();
    window.addEventListener("click", e => {
        x.click(e.target as HTMLElement);
    });
});