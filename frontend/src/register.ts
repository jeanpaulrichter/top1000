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
 * Try to register
 */
async function register() {
    const el_controls = document.getElementById("controls") as HTMLElement;
    const el_message = document.getElementById("message") as HTMLDivElement;
    const el_error = document.getElementById("error") as HTMLDivElement;
    const el_mask = document.getElementById("mask") as HTMLDivElement;

    const password = validatePassword();
    const email = validateEmail();

    if(password !== undefined && email !== undefined) {
        try {
            el_mask.classList.remove("hidden");
            const ret = await axios.post("/register", {
                "email": email,
                "password": password
            });
            if(ret.status !== 200) {
                throw ret.statusText;
            }
            el_error.classList.add("hidden");
            el_controls.classList.add("hidden");
            el_message.innerHTML = "Alles klar. Bitte überprüfe deine Emails wegen des Aktivierungslinks! Derweilen noch schnell zur <a href=\"/\">Liste</a>?";
        } catch(exc) {
            console.error(exc);
            el_error.innerHTML = "Registrierung fehlgeschlagen :(";
            el_error.classList.remove("hidden");            
        } finally {
            el_mask.classList.add("hidden");
        }
    }
}
 
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
    const el_password1 = document.getElementById("password1") as HTMLInputElement;
    const el_password2 = document.getElementById("password2") as HTMLInputElement;
    const el_btn = document.getElementById("btnSubmit") as HTMLButtonElement;
 
    el_btn.addEventListener("click", register);
    el_password1.addEventListener("keyup", validatePassword);
    el_password2.addEventListener("keyup", validatePassword);
    el_email.addEventListener("keyup", validateEmail);
    el_email.focus();
}

window.addEventListener('load', onLoad);