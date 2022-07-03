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
