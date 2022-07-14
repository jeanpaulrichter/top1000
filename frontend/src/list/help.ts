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

import axios from "../lib/redaxios.min.js"
import { ListQuery, PlatformInfo, FilterOptions, Statistics } from "./types.js";

declare global {
    interface Navigator {
        userAgentData: {
            mobile: boolean
        }
    }
}

/**
 * Not exactly sophisticated way to check if running on mobile device
 */
export function isMobileBrowser() {
    if(navigator.userAgentData !== undefined) {
        return navigator.userAgentData.mobile;
    } else {
        if(navigator.userAgent.toLowerCase().match(/mobile/i) !== null) {
            return true;
        } else {
            return window.matchMedia("only screen and (max-width: 760px)").matches;
        }
    }
}

/**
 * Encode string to html
 * @param str Input string
 * @returns HTML string
 */
export function htmlEncode(str: string) {
    // ToDo: something a little more robust =)
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Find game container element by child element
 * @param e Child element of game
 * @returns Game container
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
 * Get string from game platforms array
 * @param data Game platforms
 * @returns String of platforms
 */
export function getPlatformString(data: PlatformInfo[]): string {
    let str = "";
    for(let i = 0; i < data.length && i < 7; i++) {
        if(i > 0) {
            str += ", ";
        }
        str += data[i].name + " (" + data[i].year + ")";
    }
    if(data.length > 6) {
        str += "...";
    }
    return str;
}

/**
 * Get current filter options
 * @returns Filter options
 */
export function getFilterOptions() {
    const filter: FilterOptions = {};

    // Relevant DOM nodes
    const el_select_gender = document.getElementById("filterGender") as HTMLSelectElement;
    const el_select_age = document.getElementById("filterAge") as HTMLSelectElement;
    const el_groups = document.getElementById("filterGroups") as HTMLElement;
    
    // Gender
    if(el_select_gender.value !== "") {
        filter.gender = el_select_gender.value;
    }
    // Age    
    const age = parseInt(el_select_age.value);
    if(!(Number.isNaN(age) || age < 1 || age > 9)) {
        filter.age = age;
    }
    // Group
    const el_inputs = el_groups.getElementsByTagName("INPUT");
    for(let i = 0; i < el_inputs.length; i++) {
        const el_radio = el_inputs[i] as HTMLInputElement;
        if(el_radio.checked && el_radio.value !== "") {
            filter.group = el_radio.value;
            break;
        }
    }
    return filter;
}

/**
 * Query server for page of list
 * @param page List page
 * @param filter Filter options
 * @returns List page data
 * @throws Error
 */
export async function getListData(page: number, filter: FilterOptions): Promise<ListQuery> {
    let url = "/api/list?page=" + page;
    if(filter.group !== undefined) {
        url += "&group=" + filter.group;
    }
    if(filter.gender !== undefined) {
        url += "&gender=" + filter.gender;
    }
    if(filter.age !== undefined) {
        url += "&age=" + filter.age;
    }

    const ret = await axios.get(url);
    if(ret.status === 200) {
        return ret.data as ListQuery;
    } else {
        throw new Error(ret.statusText);
    }
}

/**
 * Query server for statistics
 * @param filter Filter options
 * @returns 
 */
export async function getChartData(filter: FilterOptions): Promise<Statistics> {
    let url = "/api/statistics?";
    if(filter.group !== undefined) {
        url += "&group=" + filter.group;
    }
    if(filter.gender !== undefined) {
        url += "&gender=" + filter.gender;
    }
    if(filter.age !== undefined) {
        url += "&age=" + filter.age;
    }

    const ret = await axios.get(url);
    if(ret.status === 200) {
        return ret.data as Statistics;
    } else {
        throw new Error(ret.statusText);
    }
}