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
 * Error thrown on bad client input
*/
export class InputError extends Error {
    constructor(...params: unknown[]) {
        if(params.length > 0 && typeof params[0] === "string") {
            super(params[0]);
        } else {
            super();
        }
        
        if(Error.captureStackTrace !== undefined) {
            Error.captureStackTrace(this, InputError)
        }
  
        this.name = "InputError"
    }
}

/**
 * Exception thrown on missing client authentication
*/
export class AuthError extends Error {
    constructor(...params : unknown[]) {
        if(params.length > 0 && typeof params[0] === "string") {
            super(params[0]);
        } else {
            super();
        }
  
        if(Error.captureStackTrace !== undefined) {
            Error.captureStackTrace(this, AuthError)
        }
  
        this.name = "AuthError"
    }
}

/**
 * Exception thrown on parsing error
*/
export class ParseError extends Error {
    constructor(...params : unknown[]) {
        if(params.length > 0 && typeof params[0] === "string") {
            super(params[0]);
        } else {
            super();
        }
  
        if(Error.captureStackTrace !== undefined) {
            Error.captureStackTrace(this, ParseError)
        }
  
        this.name = "ParseError"
    }
}

/**
 * Exception thrown when error was already logged by a subsystem
*/
export class LoggedError extends Error {
    constructor() {
        super()
  
        if(Error.captureStackTrace !== undefined) {
            Error.captureStackTrace(this, LoggedError)
        }
  
        this.name = "LoggedError"
    }
}
