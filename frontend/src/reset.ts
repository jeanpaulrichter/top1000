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

import { default as axios } from "redaxios";

type ResetElements = {
    "controls": HTMLDivElement,
    "message": HTMLDivElement,
    "error": HTMLDivElement,
    "mask": HTMLDivElement,
    "email": HTMLInputElement,
    "button": HTMLButtonElement
}

class ResetHandler {
    private el: ResetElements;

    constructor() {
        this.el = {
            "controls": document.getElementById("controls") as HTMLDivElement,
            "message": document.getElementById("message") as HTMLDivElement,
            "error": document.getElementById("error") as HTMLDivElement,
            "mask": document.getElementById("mask") as HTMLDivElement,
            "email": document.getElementById("email") as HTMLInputElement,
            "button": document.getElementById("btnSubmit") as HTMLButtonElement
        }

        this.el.button.addEventListener("click", this.onClickSubmit);
        this.el.email.addEventListener("keyup", this.onKeyUpEmail);
        this.el.email.focus();
    }

    /**
     * Make reset request
     * 
     * @param email Email string
     * @throws Error string 
     */
    private async resetRequest(email: string) {
        try {
            await axios.post("/user/reset", {
                "email": email
            });
        } catch(exc) {
            if(typeof exc === "object" && exc !== null) {
                if("status" in exc && exc.status === 400 && 
                    "data" in exc && typeof exc.data === "string" && exc.data.length > 0) {
                    throw exc.data;
                } else {
                    throw "Es ist ein Fehler aufgetreten. :(";
                }
            } else {
                throw "Verbindung zum Server nicht möglich.";
            }
        }
    }

    /**
     * Validate current value of email input
     * 
     * @returns Valid email or undefined
     */
    private validateEmail(): string | undefined {
        // Very simple but hopefully sufficient email regex
        if(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(this.el.email.value)) {
            this.el.email.classList.remove("invalid");
            return this.el.email.value;
        } else {
            this.el.email.classList.add("invalid");
            return undefined;
        }
    }

    /**
     * Reset user account
     */
    private async reset() {
        const email = this.validateEmail();
        
        if(email !== undefined) {
            try {
                this.el.mask.classList.remove("hidden");
                await this.resetRequest(email);
                this.el.message.innerHTML = "Alles klar. Bitte überprüfe deine Emails für den Rücksetzungslink! Derweilen noch schnell zur <a href=\"/\">Liste</a>?";
                this.el.error.classList.add("hidden");
                this.el.controls.classList.add("hidden");
            } catch(exc) {
                this.el.error.innerHTML = (typeof exc === "string") ? exc : "Unbekannter Fehler";
                this.el.error.classList.remove("hidden");   
            } finally {
                this.el.mask.classList.add("hidden");
            }
        }
    }

    /**
     * "keyup" event handler for email input
     */
    private onKeyUpEmail = (e: KeyboardEvent) => {
        if(e.key === "Enter") {
            this.reset().catch(err => {
                console.error(err);
            });
        } else {
            this.el.error.classList.add("hidden");
            this.validateEmail();
        }
    }

    /**
     * "click" event handler for submit button
     */
    private onClickSubmit = () => {
        this.reset().catch(err => {
            console.error(err);
        });
    }
}

window.addEventListener("load", () => {
    new ResetHandler();
});
