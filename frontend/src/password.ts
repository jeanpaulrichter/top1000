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

import axios from "redaxios";

let resettoken: string | null = null;

/**
 * Make ajax reset password request
 * @param password Password string
 * @throws Error string 
 */
 async function passwordRequest(password: string, token: string) {
    try {
        const ret = await axios.post("/user/password", {
            "password": password,
            "token": token
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
                throw "Es ist ein Fehler aufgetreten. :(";
            }
        } else {
            throw "Verbindung zum Server nicht möglich.";
        }
    }
}

/**
 * Try to reset password
 */
async function resetPassword() {
    const el_error = document.getElementById("error") as HTMLDivElement;
    const el_mask = document.getElementById("mask") as HTMLDivElement;

    const password = validatePassword();

    if(password !== undefined && resettoken !== null) {
        try {
            el_mask.classList.remove("hidden");
            await passwordRequest(password, resettoken);
            window.location.href = "/vote";
        } catch(exc) {
            el_error.innerHTML = (typeof exc === "string") ? exc : "Unbekannter Fehler";
            el_error.classList.remove("hidden");            
        } finally {
            el_mask.classList.add("hidden");
        }
    }
}

/**
 * Get validated password
 * @returns Password string
 */
function validatePassword(): string | undefined {
    const el_password1 = document.getElementById("password1") as HTMLInputElement;
    const el_password2 = document.getElementById("password2") as HTMLInputElement;

    if(el_password1.value.length >= 8 && el_password1.value === el_password2.value) {
        el_password1.classList.remove("invalid");
        el_password2.classList.remove("invalid");
        return el_password1.value;
    } else {
        el_password1.classList.add("invalid");
        el_password2.classList.add("invalid");
        return undefined;
    }
}

/**
 * Click event handler of submit button
 */
function onClickSubmit() {
    resetPassword();
}

/**
 * Initialize password page
 */
function onLoad() {
    const el_password1 = document.getElementById("password1") as HTMLInputElement;
    const el_password2 = document.getElementById("password2") as HTMLInputElement;
    const el_btn = document.getElementById("btnSubmit") as HTMLButtonElement;

    const test = window.location.href.split('?');
    if(test.length === 2) {
        const querys = new URLSearchParams(test[1]);
        resettoken = querys.get("token");
    }

    if(resettoken !== null) {
        el_btn.addEventListener("click", onClickSubmit);
        el_password1.addEventListener("keyup", validatePassword);
        el_password2.addEventListener("keyup", validatePassword);
        el_password1.focus();
    } else {
        const el_controls = document.getElementById("controls") as HTMLElement;
        const el_error = document.getElementById("controls") as HTMLElement;
        const el_message = document.getElementById("message") as HTMLElement;

        el_controls.classList.add("hidden");
        el_message.classList.add("hidden");
        el_error.classList.remove("hidden");
        el_error.innerHTML = "Ungültiges token.";
    }
}

window.addEventListener("load", onLoad);