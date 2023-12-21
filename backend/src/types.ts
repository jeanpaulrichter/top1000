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

// ----------------------------------
// Types returned by database request
// ----------------------------------

/**
 * Number of games per subgroup (genre, settings etc). Needed for VoteStatistics
 */
export type VoteGameGroup = {
    name: string,
    count: number
};

/**
 * Statistics about games in different genres, settings etc.
 */
export type VoteStatistics = {
    genres: VoteGameGroup[],
    gameplay: VoteGameGroup[],
    perspectives: VoteGameGroup[],
    settings: VoteGameGroup[],
    topics: VoteGameGroup[],
    platforms: VoteGameGroup[],
    decades: VoteGameGroup[]
};

/**
 * Possible group membership of users
 */
export type VoterGroups = {
    gamer: boolean,
    journalist: boolean,
    scientist: boolean,
    critic: boolean,
    wasted: boolean
};

/**
 * User data
 */
export type User = {
    id: string,
    salt: string,
    key: string,
    age: number,
    gender: string | undefined,
    groups: VoterGroups
};

/**
 * Information about one users vote for one game
 */
export type VoteGame = {
    id: string,
    position: number,
    comment: string,
    title?: string,
    year?: number,
    platforms?: PlatformInfo,
    icon?: string
};

// ----------------------------------
// Types used by client requests
// ----------------------------------

/**
 * Enum of possible voter groups (used by FilterOptions)
 */
export enum VoterGroup {
    Gamer = "gamer",
    Journalist = "journalist",
    Critic = "critic",
    Scientist = "scientist",
    Wasted = "wasted"
}

/**
 * Enum of possible gender values (used by FilterOptions)
 */
export enum Gender {
    Female = "female",
    Male = "male",
    Other = "other"
}

/**
 * Information about how to filter current list
 */
export type FilterOptions = {
    gender?: Gender,
    age?: number,
    group?: VoterGroup
};

// ----------------------------------
// Internal types
// ----------------------------------

/**
 * Information about user without key etc. 
 * Used as session variable for logged in clients
 */
export type UserInfo = {
    id: string,
    age: number,
    gender: string | undefined,
    groups: VoterGroups
}

declare module "express-session" {
    interface Session {
        user?: UserInfo
    }
}

/**
 * Enum of client actions that may be limited
 */
export enum ClientAction {
    login = "login",
    register = "register",
    reset = "reset",
    data = "data",
    addgame = "addgame"
}

/**
 * Information about release date on specific platform (Used by GameInfo)
 */
export type PlatformInfo = {
    name: string,
    year: number
}

/**
 * Information about a game parsed from mobygames
 */
export type GameInfo = {
    title: string,
    moby_id: number,
    description: string,
    year: number,
    icon: string,
    cover: string,
    screenshot: string,
    platforms: PlatformInfo[],    
    genres: string[],
    gameplay: string[],
    perspectives: string[],
    settings: string[],
    topics: string[]
}

/**
 * Downloaded image data
 */
export type ImageBuffer = {
    width: number,
    height: number,
    mime: string,
    data: Buffer
}

export type JSONValue =
    | string
    | number
    | boolean
    | JSONObject
    | JSONArray;

export interface JSONArray extends Array<JSONValue> {}

/**
 * Simple JSON type for api request returns
 */
export interface JSONObject {
    [x: string]: JSONValue;
}

/**
 * Possible string validation methods
 */
export enum StringValidation {
    None,
    Email,
    Password,
    Comment
}
