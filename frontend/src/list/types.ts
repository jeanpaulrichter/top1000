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

import { Chart, ChartType } from "chart.js"

/**
 * HTMLElements used by ListHandler
 */
export type ListElements = {
    mask: HTMLDivElement,
    message: HTMLDivElement,
    games: HTMLDivElement,
    pages: HTMLDivElement,
    filter: HTMLDivElement,
    filter_gender: HTMLSelectElement,
    filter_age: HTMLSelectElement,
    filter_groups: HTMLInputElement[],
    tml_game: HTMLTemplateElement,
    btn_filter: HTMLButtonElement,
    btn_statistics: HTMLButtonElement
}

/**
 * Information about platform of game
 */
export type Platform = {
    name: string,
    year: number
}

/**
 * Information about game
 */
export type Game = {
    id: string,
    title: string,
    moby_id: number,
    description: string,
    genres: string[],
    screenshots: string[],
    platforms: Platform[],
    year: number,
    cover: string,
    screenshot: string,
    icon: string
}

/**
 * Information about list entry
 */
export type ListEntry = {
    rank: number,
    votes: number,
    score: number,
    comments: string[],
    game: Game
}

/**
 * Data returned by api for list page
 */
export type ListData = {
    pages: number,
    limit: number,
    data: ListEntry[]
}

/**
 * Filter Options
 */
export type FilterOptions = {
    group: string,
    gender: string,
    age: number
}

/**
 * Game categories retured by statistics api
 */
export enum GameCategory {
    genres = "genres",
    gameplay = "gameplay",
    perspectives = "perspectives",
    settings = "settings",
    topics = "topics",
    platforms = "platforms",
    decades = "decades"
}

/**
 * See type Statistics
 */
export type GameCategoryEntry = {
    name: string,
    count: number
};

/**
 * Statistics returns by api
 */
export type Statistics = {
    [key in GameCategory]: GameCategoryEntry[]
};

/**
 * Stump chartjs data object
 */
export type ChartData = {
    labels: string[],
    datasets: {
        data: number[],
        backgroundColor: string[],
    }[]
};

/**
 * Statistics chart for GameCategory
 */
export type GameChart = {
    category: `${GameCategory}`,
    chart: Chart,
    whitelist?: string[]
}

/**
 * Options for statistics chart
 */
export type GameChartOptions = {
    id: string,
    type: ChartType,
    category: `${GameCategory}`,
    title: string,
    whitelist?: string[]
}
