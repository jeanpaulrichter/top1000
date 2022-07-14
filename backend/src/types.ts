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

export type VoterGroups = {
    gamer: boolean,
    journalist: boolean,
    scientist: boolean,
    critic: boolean,
    wasted: boolean
};

export type VoteGame = {
    id: string,
    position: number,
    comment: string,
    title?: string,
    year?: number,
    platforms?: PlatformInfo,
    icon?: string
};

export enum Gender {
    Female = "female",
    Male = "male",
    Other = "other"
}

export enum VoterGroup {
    Gamer = "gamer",
    Journalist = "journalist",
    Critic = "critic",
    Scientist = "scientist",
    Wasted = "wasted"
}

export type User = {
    id: string,
    salt: string,
    key: string,
    age: number,
    gender: string | undefined,
    groups: VoterGroups
};

export type UserInfo = {
    id: string,
    age: number,
    gender: string | undefined,
    groups: VoterGroups
}

export type PlatformInfo = {
    name: string,
    year: number
}

export type GameInfo = {
    title: string,
    moby_id: number,
    moby_url: string,
    description: string,
    year: number,
    cover_url?: string,
    thumbnail_url?: string,    
    platforms: PlatformInfo[],
    screenshots: string[],
    genres: string[],
    gameplay: string[],
    perspectives: string[],
    settings: string[],
    topics: string[],
    icon?: string,
    image?: Buffer
}

export enum ClientAction {
    login = "login",
    register = "register",
    reset = "reset",
    data = "data",
    addgame = "addgame"
}

export type VotesGameGroup = {
    name: string,
    count: number
};

export type VotesStatistics = {
    genre: VotesGameGroup[],
    gameplay: VotesGameGroup[],
    perspective: VotesGameGroup[],
    setting: VotesGameGroup[],
    topic: VotesGameGroup[],
    platforms: VotesGameGroup[]
};

export type FilterOptions = {
    gender?: Gender,
    age?: number,
    group?: VoterGroup
};

// Declare session variables for typescript
declare module "express-session" {
    interface Session {
        user?: UserInfo
    }
}