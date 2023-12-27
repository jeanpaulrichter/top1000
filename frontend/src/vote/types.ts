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

/**
 * Vote page element
 */
export type VoteElements = {
    slides: HTMLElement,
    step: HTMLDivElement,
    progress: HTMLDivElement,
    gender: HTMLSelectElement,
    age: HTMLSelectElement,
    group_hobby: HTMLInputElement,
    group_journalist: HTMLInputElement,
    group_scientist: HTMLInputElement,
    group_critic: HTMLInputElement,
    group_wasted: HTMLInputElement,
    group_notwasted: HTMLInputElement,
    btn_next: HTMLButtonElement,
    btn_prev: HTMLButtonElement,
    btn_help: HTMLButtonElement,
    btn_addgame: HTMLButtonElement,
    tml_slide: HTMLTemplateElement,
    tml_game: HTMLTemplateElement,
    dlg_help: HTMLDivElement,
    addgame_url: HTMLInputElement,
    addgame_msg: HTMLSpanElement
}

/**
 * Game platform info
 */
export type PlatformInfo = {
    name: string,
    year: number
}

/**
 * Suggested game for autocomplete
 */
export type GameInfo = {
    id: string,
    title: string,
    year: number,
    icon?: string,
    platforms: PlatformInfo[],
    text?: string
}

/**
 * Information about user
 */
export type UserInfo = {
    gender: string,
    age: number,
    gamer: boolean,
    journalist: boolean,
    scientist: boolean,
    critic: boolean,
    wasted: boolean
}

/**
 * Vote information
 */
export type VoteInfo = {
    position: number,
    comment?: string
} & GameInfo;

/**
 * Search result for select2 autocomplete
 */
export type SearchResult = {
    results: GameInfo[],
    pagination: {
        more: boolean
    }
}

/**
 * Options for slide with game selectors
 */
export type SlideOptions = {
    text: string,
    games: number
}

/**
 * Set focus on voting list item
 */
export type S2Callback_focus = (e: HTMLElement, focus: boolean) => void;

/**
 * Autocomplete API request parameter
 */
export type AutocompleteAPIParam = {
    page: number,
    search: string
}