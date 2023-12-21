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
import { Modal } from "bootstrap";

type RegisterElements = {
    dlg_privacy: HTMLElement,
    controls: HTMLDivElement,
    message: HTMLDivElement,
    error: HTMLDivElement,
    mask: HTMLDivElement,
    email: HTMLInputElement,
    password1: HTMLInputElement,
    password2: HTMLInputElement,
    btn_submit: HTMLButtonElement,
    btn_privacy: HTMLButtonElement
}

class RegisterHandler {
    private el: RegisterElements;
    private dlg_privacy: Modal;

    constructor() {
        this.el = {
            "dlg_privacy": document.getElementById("dlgPrivacy") as HTMLElement,
            "controls": document.getElementById("controls") as HTMLDivElement,
            "message": document.getElementById("message") as HTMLDivElement,
            "error": document.getElementById("error") as HTMLDivElement,
            "mask": document.getElementById("mask") as HTMLDivElement,
            "email": document.getElementById("email") as HTMLInputElement,
            "password1": document.getElementById("password1") as HTMLInputElement,
            "password2": document.getElementById("password2") as HTMLInputElement,
            "btn_submit": document.getElementById("btnSubmit") as HTMLButtonElement,
            "btn_privacy": document.getElementById("btnPrivacy") as HTMLButtonElement
        }

        this.dlg_privacy = new Modal(this.el.dlg_privacy, {
            "keyboard": false,
            "focus": true
        });
     
        this.el.btn_privacy.addEventListener("click", this.onClickBtnPrivacy);
        this.el.btn_submit.addEventListener("click", this.onClickBtnSubmit);
        this.el.password1.addEventListener("keyup", this.onKeyUpPassword);
        this.el.password2.addEventListener("keyup", this.onKeyUpPassword);
        this.el.email.addEventListener("keyup", this.onKeyUpEmail);

        this.el.email.focus();
    }

    /**
     * Make user register request
     * 
     * @param email Email string
     * @param password Password string
     */
    private async registerRequest(email: string, password: string): Promise<void> {
        try {
            await axios.post("/user/register", {
                "email": email,
                "password": password
            });
        } catch(exc) {
            if(typeof exc === "object" && exc !== null) {
                if("status" in exc && exc.status === 400 && 
                    "data" in exc && typeof exc.data === "string" && exc.data.length > 0) {
                    throw exc.data;
                } else {
                    throw "Es ist ein Fehler aufgetreten";
                }
            } else {
                throw "Verbindung zum Server nicht möglich";
            }
        }
    }

    /**
     * Validate current value of password inputs
     * 
     * @returns Valid password string of undefined
     */
    private validatePassword(): string | undefined {
        if(this.el.password1.value.length >= 8 && this.el.password1.value === this.el.password2.value) {
            this.el.password1.classList.remove("invalid");
            this.el.password2.classList.remove("invalid");
            return this.el.password1.value;
        } else {
            this.el.password1.classList.add("invalid");
            this.el.password2.classList.add("invalid");
            return undefined;
        }
    }

    /**
     * Validate current value of email input
     * 
     * @returns Valid email string or undefined
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
     * Register new user account
     */
    private async register(): Promise<void> {
        const password = this.validatePassword();
        const email = this.validateEmail();
    
        if(password !== undefined && email !== undefined) {
            try {
                this.el.mask.classList.remove("hidden");
                await this.registerRequest(email, password);
                this.el.error.classList.add("hidden");
                this.el.controls.classList.add("hidden");
                this.el.message.innerHTML = "Alles klar. Bitte überprüfe deine Emails wegen des Aktivierungslinks! Derweilen noch schnell zur <a href=\"/\">Liste</a>?";
            } catch(exc) {
                this.el.error.innerHTML = typeof exc == "string" ? exc : "Registrierung fehlgeschlagen";
                this.el.error.classList.remove("hidden"); 
            } finally {
                this.el.mask.classList.add("hidden");
            }
        }
    }

    /**
     * Privacy dialog button "click" handler
     */
    private onClickBtnPrivacy = () => {
        this.dlg_privacy.toggle();
    }

    /**
     * Submit button "click" handler
     */
    private onClickBtnSubmit = () => {
        this.register().catch(err => {
            console.error(err);
        })
    }

    /**
     * Password inputs "keyup" event handler
     */
    private onKeyUpPassword = (e: KeyboardEvent) => {
        if(e.key === "Enter") {
            this.register().catch(err => {
                console.error(err);
            });
        } else {
            this.el.error.classList.add("hidden");
            this.validatePassword();
        }
    }

    /**
     * Email input "keyup" event handler
     */
    private onKeyUpEmail = (e: KeyboardEvent) => {
        if(e.key === "Enter") {
            this.register().catch(err => {
                console.error(err);
            });
        } else {
            this.el.error.classList.add("hidden");
            this.validateEmail();
        }
    }
}

window.addEventListener("load", () => {
    new RegisterHandler();
});