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

/**
 * Make ajax reset request
 * @param email Email string
 * @throws Error string 
 */
async function resetRequest(email: string) {
    try {
        const ret = await axios.post("/reset", {
            "email": email
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
 * Click event handler for submit button
 */
async function onClickSubmit() {
    const el_controls = document.getElementById("controls") as HTMLElement;
    const el_message = document.getElementById("message") as HTMLDivElement;
    const el_error = document.getElementById("error") as HTMLDivElement;
    const el_mask = document.getElementById("mask") as HTMLDivElement;

    const email = validateEmail();

    if(email !== undefined) {
        try {
            el_mask.classList.remove("hidden");
            await resetRequest(email);

            el_error.classList.add("hidden");
            el_controls.classList.add("hidden");
            el_message.innerHTML = "Alles klar. Bitte überprüfe deine Emails für den Rücksetzungslink! Derweilen noch schnell zur <a href=\"/\">Liste</a>?";
        } catch(exc) {
            el_error.innerHTML = (typeof exc === "string") ? exc : "Unbekannter Fehler";
            el_error.classList.remove("hidden");            
        } finally {
            el_mask.classList.add("hidden");
        }
    }
}

function validateEmail(): string | undefined {
    const el_email = document.getElementById("email") as HTMLInputElement;

    // Very simple but hopefully sufficient email regex
    if(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(el_email.value)) {
        el_email.classList.remove("invalid");
        return el_email.value;
    } else {
        el_email.classList.add("invalid");
        return undefined;
    }
}

function onLoad() {
    const el_email = document.getElementById("email") as HTMLInputElement;
    const el_btn = document.getElementById("btnSubmit") as HTMLButtonElement;
 
    el_btn.addEventListener("click", onClickSubmit);
    el_email.addEventListener("keyup", validateEmail);
    el_email.focus();
}

window.addEventListener("load", onLoad);