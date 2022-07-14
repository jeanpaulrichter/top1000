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
 * Information about platform of game
 */
export type PlatformInfo = {
    name: string,
    year: number
}

/**
 * Information about game
 */
export type GameInfo = {
    id: string,
    title: string,
    moby_id: number,
    moby_url: string,
    description: string,
    genres: string[],
    screenshots: string[],
    platforms: PlatformInfo[],
    year: number,
    cover_url: string,
    thumbnail_url: string,
    icon?: string
}

/**
 * Information about list entry
 */
export type ListInfo = {
    rank: number,
    votes: number,
    score: number,
    comments: string[],
    game: GameInfo
}

/**
 * Data returned by server for list page
 */
export type ListQuery = {
    pages: number,
    limit: number,
    data: ListInfo[]
}

/**
 * Filter Options
 */
export type FilterOptions = {
    group?: string,
    gender?: string,
    age?: number
}

/**
 * 
 */
export type GameGroup = {
    name: string,
    count: number
};

/**
 * Statistics returns by API
 */
export type Statistics = {
    genre: GameGroup[],
    gameplay: GameGroup[],
    perspective: GameGroup[],
    setting: GameGroup[],
    topic: GameGroup[],
    platforms: GameGroup[],
    [key: string]: GameGroup[]
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
 * Stump chartjs instance
 */
export type Chart = {
    destroy(): void
};

/**
 * Definition of statistics chart
 */
export type ChartInfo = {
    canvas: HTMLCanvasElement,
    obj: Chart | undefined,
    type: string,
    name: string,
    options: { [key: string]: unknown }
    filter?: string[]
}