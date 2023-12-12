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

/*
    Various functions to validate client data
*/

import { Gender, VoterGroup, FilterOptions, StringValidation } from "./types";
import { InputError } from "./exceptions";

const email_regex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

/**
 * Get valid string
 * @param s Input
 * @param error_msg Message of thrown exception
 * @param min_length Minimum length of string (Default: 0)
 * @param max_length Maximum length of string (Default: 512)
 * @param check Additional check performed on string (Default: None)
 * @returns string
 * @throws InputError
 */
export function validateString(s: unknown, error_msg: string, min_length = 0, max_length = 512, check = StringValidation.None): string {
    if(typeof s !== "string" || s.length < min_length || s.length > max_length) {
        throw new InputError(error_msg);
    }
    switch(check) {
        case StringValidation.Email: {
            if(!email_regex.test(s)) {
                throw new InputError(error_msg);
            }
        }
    }
    return s;
}

/**
 * Get valid integer
 * @param s Input
 * @param error_msg Message of thrown exception
 * @param min_value Minimum value of integer (optional)
 * @param max_value Maximum value of integer (optional)
 * @returns Integer number
 * @throws InputError
 */
export function validateInteger(s: unknown, error_msg: string, min_value = Number.MIN_SAFE_INTEGER, max_value = Number.MAX_SAFE_INTEGER): number {
    let n: number;
    if(typeof s == "number") {
        n = s;
    } else if(typeof s == "string") {
        n = parseInt(s);
    } else {
        throw new InputError(error_msg);
    }
    if(Number.isNaN(n) || !Number.isInteger(n) || n < min_value || n > max_value) {
        throw new InputError(error_msg);
    }
    return n;
}

/**
 * Get valid Gender enum
 * @param s Input
 * @param error_msg Message of thrown exception
 * @returns Gender enum
 * @throws InputError
 */
export function validateGender(s: unknown, error_msg: string): Gender {
    if(typeof s !== "string") {
        throw new InputError("Invalid gender");
    }
    switch(s) {
        case "female":
            return Gender.Female;
        case "male":
            return Gender.Male;
        case "other":
            return Gender.Other;
        default:
            throw new InputError(error_msg);
    }
}

/**
 * Get valid VoterGroup enum
 * @param s Input
 * @param error_msg Message of thrown exception
 * @returns VoterGroup enum
 * @throws InputError
 */
function validateVoterGroup(s: unknown, error_msg: string): VoterGroup {
    switch(s) {
        case "gamer":
            return VoterGroup.Gamer;
        case "journalist":
            return VoterGroup.Journalist;
        case "scientist":
            return VoterGroup.Scientist;
        case "critic":
            return VoterGroup.Critic;
        case "wasted":
            return VoterGroup.Wasted;
        default:
            throw new InputError(error_msg);
    }
}

/**
 * Get valid FilterOptions
 * @param gender Gender (expected: male, female or other)
 * @param age Age (expected: 1-9)
 * @param group Group
 * @param error_msg Message of thrown exception
 * @returns FilterOptions
 * @throws InputError
 */
export function validateFilterParams(gender: unknown, age: unknown, group: unknown): FilterOptions {
    const options: FilterOptions = {};

    // Validate gender
    if(typeof gender === "string") {
        options.gender = validateGender(gender, "Filter: invalid gender");
    }

    // Validate age
    if(typeof age === "string") {
        options.age = validateInteger(age, "Filter: Invalid age", 1, 9)
    }

    // Validate group
    if(typeof group === "string") {
        options.group = validateVoterGroup(group, "Filter: Invalid group");
    }
    
    return options;
}

