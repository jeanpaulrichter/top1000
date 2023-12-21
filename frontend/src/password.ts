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

type ResetPWElements = {
    controls: HTMLDivElement,
    message: HTMLDivElement,
    error: HTMLDivElement,
    mask: HTMLDivElement,
    password1: HTMLInputElement,
    password2: HTMLInputElement,
    btn_submit: HTMLButtonElement
}

class ResetPWHandler {
    private el: ResetPWElements;
    private token: string | null;

    constructor() {
        this.el = {
            "controls": document.getElementById("controls") as HTMLDivElement,
            "message": document.getElementById("message") as HTMLDivElement,
            "error": document.getElementById("error") as HTMLDivElement,
            "mask": document.getElementById("mask") as HTMLDivElement,
            "password1": document.getElementById("password1") as HTMLInputElement,
            "password2": document.getElementById("password2") as HTMLInputElement,
            "btn_submit": document.getElementById("btnSubmit") as HTMLButtonElement
        }

        const test = window.location.href.split('?');
        if(test.length === 2) {
            const querys = new URLSearchParams(test[1]);
            this.token = querys.get("token");
        } else {
            this.token = null;
        }
    
        if(this.token !== null) {
            this.el.btn_submit.addEventListener("click", this.onClickSubmit);
            this.el.password1.addEventListener("keyup", this.onKeyUpPassword);
            this.el.password2.addEventListener("keyup", this.onKeyUpPassword);
            this.el.password1.focus();
        } else {
            this.el.controls.classList.add("hidden");
            this.el.message.classList.add("hidden");
            this.el.error.classList.remove("hidden");
            this.el.error.innerHTML = "Missing token.";
        }
    }

    /**
     * Make reset password request
     * 
     * @param password Password string
     * @param token Token string
     * @throws Error string 
     */
    private async passwordRequest(password: string, token: string) {
        try {
            await axios.post("/user/password", {
                "password": password,
                "token": token
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
     * Get validated password
     * 
     * @returns Valid password string or undefined
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
     * Reset password
     */
    private async resetPassword() {
        const password = this.validatePassword();

        if(password !== undefined && this.token !== null) {
            try {
                this.el.mask.classList.remove("hidden");
                await this.passwordRequest(password, this.token);
                window.location.href = "/vote";
            } catch(exc) {
                this.el.error.innerHTML = (typeof exc === "string") ? exc : "Unbekannter Fehler";
                this.el.error.classList.remove("hidden");            
            } finally {
                this.el.mask.classList.add("hidden");
            }
        }
    }

    /**
     * "click" event handler of password inputs
     */
    private onKeyUpPassword = (e: KeyboardEvent) => {
        if(e.key === "Enter") {
            this.resetPassword().catch(err => {
                console.error(err);
            });
        } else {
            this.el.error.classList.add("hidden");
            this.validatePassword();
        }
    }

    /**
     * Submit button "click" event handler
     */
    private onClickSubmit = () => {
        this.resetPassword().catch(err => {
            console.error(err);
        })
    }
}

window.addEventListener("load", () => {
    new ResetPWHandler();
});