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

type LoginElements = {
    email: HTMLInputElement,
    password: HTMLInputElement,
    error: HTMLDivElement
    button: HTMLButtonElement
}

class LoginHandler {
    private el: LoginElements;

    constructor() {
        this.el = {
            "email": document.getElementById("email") as HTMLInputElement,
            "password": document.getElementById("password") as HTMLInputElement,
            "error": document.getElementById("error") as HTMLDivElement,
            "button": document.getElementById("btnSubmit") as HTMLButtonElement
        };

        this.el.button.addEventListener("click", this.onClickSubmit);
        this.el.password.addEventListener("keyup", this.onKeyUp);    
        this.el.email.addEventListener("keyup", this.onKeyUp);
        this.el.email.focus();
    }

    /**
     * Make login request
     * 
     * @param email Email string
     * @param password Password string 
     * @throws Error string 
     */
    private async loginRequest(email: string, password: string): Promise<void> {
        try {
            await axios.post("/user/login", {
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
     * Login
     */
    private async login() {
        const password = this.el.password.value;
        const email = this.el.email.value;

        if(password.length > 0 && email.length > 0) {
            try {
                await this.loginRequest(email, password);
                window.location.href = "/vote";
            } catch(exc) {
                this.el.error.innerHTML = (typeof exc === "string") ? exc : "Unbekannter Fehler";
                this.el.error.classList.remove("hidden");
            }
        } else {
            let el_focus: HTMLInputElement | undefined = undefined;
            if(password.length == 0) {
                this.el.password.classList.add("invalid");
                el_focus = this.el.password;
            }
            if(email.length == 0) {
                this.el.email.classList.add("invalid");
                el_focus = this.el.email;
            }
            if(el_focus) {
                el_focus.focus();
            }
        }
    }

    /**
     * Validate current input values
     */
    private validateInput() {
        const password = this.el.password.value;
        const email = this.el.email.value;

        if(password.length == 0) {
            this.el.password.classList.add("invalid");
        } else {
            this.el.password.classList.remove("invalid");
        }
        if(email.length == 0) {
            this.el.email.classList.add("invalid");
        } else {
            this.el.email.classList.remove("invalid");
        }
    }

    /**
     * Click event handler for submit button
     */
    private onClickSubmit = () => {
        this.login();
    }
    
    /**
     * KeyUp event for input boxes
     * 
     * @param e Event
     */
    private onKeyUp = (e: KeyboardEvent) => {
        if(e.key === "Enter") {
            this.login().catch(err => {
                console.error(err);
            });
        } else {
            const el_error = document.getElementById("error") as HTMLDivElement;
            el_error.classList.add("hidden");
            this.validateInput();
        }
    }
}

window.addEventListener("load", () => {
    new LoginHandler();
});