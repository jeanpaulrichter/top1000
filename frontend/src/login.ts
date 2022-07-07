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

import axios from "./lib/redaxios.min.js";

/**
 * Make login request
 * @param email Email string
 * @param password Password string 
 * @throws Error string 
 */
async function loginRequest(email: string, password: string) {
    try {
        const ret = await axios.post("/login", {
            "email": email,
            "password": password
        });
        if(ret.status !== 200) {
            throw new Error();
        }
    } catch(exc) {
        if(typeof exc === "object" && exc !== null) {
            const e = exc as { [key: string]: unknown };
            if(e.status === 400 && typeof e.data === "string" && e.data.length > 0) {
                throw e.data;
            } else {
                throw "Es ist ein Fehler aufgetreten";
            }
        } else {
            throw "Verbindung zum Server nicht möglich";
        }
    }
}

/**
 * Try to login...
 */
async function login() {
    const el_error = document.getElementById("error") as HTMLDivElement;
    const el_email = document.getElementById("email") as HTMLInputElement;
    const el_password = document.getElementById("password") as HTMLInputElement;
    const password = el_password.value;
    const email = el_email.value;

    if(password.length > 0 && email.length > 0) {
        try {
            await loginRequest(email, password);
            window.location.href = "/vote";
        } catch(exc) {
            el_error.innerHTML = (typeof exc === "string") ? exc : "Unbekannter Fehler";
            el_error.classList.remove("hidden");
        }
    } else {
        if(password.length == 0) {
            el_password.classList.add("invalid");
        }
        if(email.length == 0) {
            el_email.classList.add("invalid");
        }
    }
}

/**
 * Click event handler for submit button
 */
function onClickSubmit() {
    login();
}
 
/**
 * KeyUp event for input boxes
 * @param e Event
 */
function onKeyUp(e: KeyboardEvent) {
    if(e.key === "Enter") {
        login();
    } else {
        const el = e.target as HTMLInputElement;
        if(el.value.length > 0) {
            el.classList.remove("invalid");
        }
    }
}

/**
 * Setup event listener
 */
window.addEventListener('load', () => {
     const el_email = document.getElementById("email") as HTMLInputElement;
     const el_password = document.getElementById("password") as HTMLInputElement;
     const el_btn = document.getElementById("btnSubmit") as HTMLButtonElement;
 
     el_btn.addEventListener("click", onClickSubmit);
     el_password.addEventListener("keyup", onKeyUp);    
     el_email.addEventListener("keyup", onKeyUp);
     el_email.focus();
 });