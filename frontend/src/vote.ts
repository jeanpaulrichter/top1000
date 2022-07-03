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

import { setupSelect2, setSelect2Value, updateProgress } from "./vote/select2.js";
import { findGame, findSlide } from "./vote/help.js";
import { setFocus } from "./vote/focus.js";
import { SlideOptions, UserInfo, VoteInfo } from "./vote/types.js";
import axios from "./lib/redaxios.min.js";

declare global {
    interface Window {
        bootstrap: {
            Tooltip: new(el: Element) => unknown;
        }
    }
}

/**
 * Slides with dropdown controls for game selection are dynamiclly created according to this object
 */
const slides: SlideOptions[] = [
    {
        "text": "Wähle jetzt deine Top-10 Videospiele aller Zeiten. Wenn du zu einem Spiel einen kurzen Kommentar hinterlassen möchtest, klicke auf den Button rechts neben dem Dropdown-Menü.",
        "games": 10
    },
    {
        "text": "Weiter geht es: Die Spiele 11 bis 20 auf deiner ewigen Bestenliste!",
        "games": 10
    },
    {
        "text": "Fast geschafft! Nur noch zehn weitere Spiele... ",
        "games": 10
    }
]

/**
 * Create slides
 */
function createSlides() {
    // HTML templates for slide and game selector
    const tml_slide = document.getElementById("tml_slide") as HTMLTemplateElement;
    const tml_game = document.getElementById("tml_game") as HTMLTemplateElement;

    // Main form to append slides to
    const el_form = document.getElementById("form") as HTMLElement;

    let game_count = 0;
    let step = 2;
    const step_max = slides.length + 1;

    for(const slide of slides) {
        // Create new slide
        const new_slide = tml_slide.content.cloneNode(true) as HTMLElement;
        // Relevant nodes of new slide
        const el_slide_div = new_slide.querySelector("div.slide") as HTMLDivElement;
        const el_slide_step = new_slide.querySelector("span.slide__step") as HTMLSpanElement;
        const el_slide_text = new_slide.querySelector("span.slide__text") as HTMLSpanElement;
        const el_slide_games = new_slide.querySelector("div.slide__games") as HTMLDivElement;
        const el_slide_buttons = new_slide.querySelectorAll("button");

        // Set slide id
        el_slide_div.id = `slide${step}`;

        // Setup slide step and help text
        el_slide_step.innerHTML = `${step}/${step_max}`;
        el_slide_text.innerHTML = slide.text;

        // Setup slide buttons
        el_slide_buttons[0].innerHTML = "Zurück";
        el_slide_buttons[0].value = "back";
        el_slide_buttons[0].addEventListener("click", onClickButtonSlide);

        if(step === step_max) {
            const el_parent = el_slide_buttons[1].parentElement as HTMLElement;
            el_parent.removeChild(el_slide_buttons[1]);
        } else {
            el_slide_buttons[1].innerHTML = "Weiter";
            el_slide_buttons[1].value = "next";        
            el_slide_buttons[1].addEventListener("click", onClickButtonSlide);
        }

        // Create game selectors for slide
        for(let i = 0; i < slide.games; i++) {
            const game_index = game_count + i;
            const game_number = game_index + 1;
            const game_name = `game${game_number}`;

            // Create new game selector from template
            const new_game = tml_game.content.cloneNode(true) as HTMLElement;
            // Relevant nodes of new game selector
            const el_game_div = new_game.querySelector("div.game") as HTMLDivElement;
            const el_game_number = new_game.querySelector("span.game__number") as HTMLSpanElement;
            const el_game_select = new_game.querySelector("select") as HTMLSelectElement;
            const el_game_btn_expand = new_game.querySelector("button[value='expand']") as HTMLButtonElement;
            const el_game_textarea = new_game.querySelector("textarea") as HTMLTextAreaElement;

            // Setup names, ids and eventhandler etc.
            el_game_div.dataset.index = game_index.toString();
            el_game_number.innerHTML = game_number.toString() + ".";
            el_game_btn_expand.addEventListener("click", onClickButtonExpand);
            el_game_textarea.id = game_name + "_comment";
            el_game_textarea.name = game_name + "_comment";
            el_game_textarea.addEventListener("blur", onGameCommentBlur);

            // Setup select2
            el_game_select.name = game_name;
            el_game_select.id = game_name;
            el_game_select.dataset.position = game_number.toString();
            el_game_select.dataset.index = game_index.toString();
            setupSelect2(el_game_select);

            // Add game selector to slide
            el_slide_games.appendChild(new_game);
        }

        // Append slide to form
        el_form.appendChild(new_slide);

        game_count += slide.games;
        step += 1;
    }
}

/* ------------------------------------------------------------------------------------------------------------------------------------------ */
/* Event handlers */

/**
 * Setup page eventhandlers etc
 */
 function onLoad() {
    // Create slides
    createSlides();

    // Next button of slide1
    const el_btn = document.getElementById("btnSlide1Next") as HTMLButtonElement;
    el_btn.addEventListener("click", onClickButtonSlide);

    const el_btn_addgame = document.getElementById("btnAddGame") as HTMLButtonElement;
    el_btn_addgame.addEventListener("click", onClickAddGame);

    const el_help_dlg = document.getElementById("dlgHelp") as HTMLElement;
    el_help_dlg.addEventListener("hidden.bs.modal", onCloseHelpDialog);
    

    // Userinfo controls
    // Get relevant DOM nodes
    const el_gender = document.getElementById("genderSelect") as HTMLSelectElement;
    const el_age = document.getElementById("ageSelect") as HTMLSelectElement;
    const el_group_hobby = document.getElementById("checkGroupHobby") as HTMLInputElement;
    const el_group_journalist = document.getElementById("checkGroupJournalist") as HTMLInputElement;
    const el_group_scientist = document.getElementById("checkGroupScientist") as HTMLInputElement;
    const el_group_critic = document.getElementById("checkGroupCritic") as HTMLInputElement;
    const el_check_wasted = document.getElementById("radioWasted") as HTMLInputElement;
    const el_check_not_wasted = document.getElementById("radioNotWasted") as HTMLInputElement;
    el_gender.addEventListener("change", onChangeUserInfo);
    el_age.addEventListener("change", onChangeUserInfo);
    el_group_hobby.addEventListener("change", onChangeUserInfo);
    el_group_journalist.addEventListener("change", onChangeUserInfo);
    el_group_scientist.addEventListener("change", onChangeUserInfo);
    el_group_critic.addEventListener("change", onChangeUserInfo);
    el_check_wasted.addEventListener("change", onChangeUserInfo);
    el_check_not_wasted.addEventListener("change", onChangeUserInfo);

    // Setup tooltips
    const el_menu = document.getElementById("menu") as HTMLElement;
    for(const el_tooltip of el_menu.querySelectorAll("button")) {
        new window.bootstrap.Tooltip(el_tooltip);
    }

    // Get initial user info from server
    axios.get("api/user").then(ret => {
        const user = ret.data as UserInfo;
        if(user !== undefined && !Array.isArray(user)) {
            el_gender.value = user.gender;
            el_age.value = user.age.toString();
            el_group_hobby.checked = user.gamer;
            el_group_journalist.checked = user.journalist;
            el_group_scientist.checked = user.scientist;
            el_group_critic.checked = user.critic;
            el_check_wasted.checked = user.wasted;
            el_check_not_wasted.checked = !user.wasted;
        }
    }).catch(err => {
        console.error(err);
    });

    // Get current votes from server
    axios.get("api/votes").then(ret => {
        const votes = ret.data as VoteInfo[];
        if(Array.isArray(votes)) {
            for(const vote of votes) {
                const el_select = document.getElementById("game" + vote.position) as HTMLSelectElement;
                setSelect2Value(el_select, vote);
                if(typeof vote.comment === "string" && vote.comment.length > 0) {
                    const el_text = document.getElementById(`game${vote.position}_comment`) as HTMLTextAreaElement;
                    el_text.value = vote.comment;
                }
            }
        }
        updateProgress();
    }).catch(err => {
        console.error(err);
    });
}

/**
 * Click event handler for expand/collapse button of game selectors
 * @param e Event
 */
function onClickButtonExpand(e: Event) {
    if(e.target instanceof HTMLElement) {
        const el_game = findGame(e.target);
        if(el_game !== null) {
            setFocus(el_game, !el_game.classList.contains("game--focus"), true);
        }
    }
}

/**
 * Click event handler for slide buttons
 * @param e Event
 */
function onClickButtonSlide(e: Event) {
    const el = e.target as HTMLButtonElement;

    switch(el.value) {
        case "submit": 
            break;

        case "next": case "back": {
            const el_slide = findSlide(el.parentElement as HTMLElement) as HTMLElement;
            if(el.value === "next") {
                // Show next slide
                const el_next = el_slide.nextElementSibling as HTMLElement;
                el_next.classList.remove("hidden");
                el_slide.classList.add("hidden");
            } else {
                // Show previous slide
                const el_prev = el_slide.previousElementSibling as HTMLElement;
                el_prev.classList.remove("hidden");
                el_slide.classList.add("hidden"); 
            }
            // Scroll to top after dom changes
            setTimeout(() => {
                window.scrollTo(0, 0);
            }, 10);
            break;
        }
    }
}

/**
 * Save user info on change of controls
 */
function onChangeUserInfo() {
    // Get relevant DOM nodes
    const el_gender = document.getElementById("genderSelect") as HTMLSelectElement;
    const el_age = document.getElementById("ageSelect") as HTMLSelectElement;
    const el_group_hobby = document.getElementById("checkGroupHobby") as HTMLInputElement;
    const el_group_journalist = document.getElementById("checkGroupJournalist") as HTMLInputElement;
    const el_group_scientist = document.getElementById("checkGroupScientist") as HTMLInputElement;
    const el_group_critic = document.getElementById("checkGroupCritic") as HTMLInputElement;
    const el_check_wasted = document.getElementById("radioWasted") as HTMLInputElement;

    const gender = (el_gender.value === "") ? undefined : el_gender.value;
    const age = el_age.value;
    const gamer = (el_group_hobby.checked) ? "gamer": undefined;
    const journalist = (el_group_journalist.checked) ? "journalist": undefined;
    const scientist = (el_group_scientist.checked) ? "scientist": undefined;
    const critic = (el_group_critic.checked) ? "critic": undefined;
    const wasted = (el_check_wasted.checked) ? "yes": undefined;

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
 * Blur event of comment textareas: save content
 * @param e Event
 */
function onGameCommentBlur(e: Event) {
    const el_text = e.target as HTMLTextAreaElement;
    const el_game = findGame(el_text) as HTMLElement;
    const el_select = el_game.querySelector("select") as HTMLSelectElement;
    if(el_select.value !== "" && el_text.value !== "") {
        axios.post("/api/comment", {
            "position": el_select.dataset.position,
            "comment": el_text.value
        }).catch(err => {
            console.error(err);
        });
    }
}

/**
 * Click event handler for "Add Game" button of help dialog
 * @param e Event
 */
function onClickAddGame(e: Event) {
    const el_btn = e.target as HTMLButtonElement;
    const el_input = document.getElementById("inputGameID") as HTMLInputElement;
    const el_msg = document.getElementById("addGameMsg") as HTMLDivElement;
    el_btn.disabled = true;
    el_input.disabled = true;
    el_msg.className = "hidden";

    // Try to add game to database...
    axios.post("/api/addgame", {
        "moby_id": el_input.value
    }).then(() => {
        el_msg.className = "help-dialog__msg help-dialog__msg--success";
        el_msg.innerHTML = "Spiel hinzugefügt."; 
    }).catch(err => {
        el_msg.className = "help-dialog__msg help-dialog__msg--error";
        el_msg.innerHTML = "Einfügen des Spieles fehlgeschlagen."; 
        console.error(err);
    }).finally(() => {
        el_btn.disabled = false;
        el_input.disabled = false;
    })
}

/**
 * Hide dialog message on close (for next time...)
 */
function onCloseHelpDialog() {
    const el_msg = document.getElementById("addGameMsg") as HTMLDivElement;
    el_msg.className = "hidden";
}

/* ------------------------------------------------------------------------------------------------------------------------------------------ */

window.addEventListener("load", onLoad);