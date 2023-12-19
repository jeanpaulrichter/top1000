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

import { SMTPClient, Message } from 'emailjs';
import { ConfigData } from "./config.js";

/**
 * Simple helper class to send emails
 */
export class Mailer {
    private config: ConfigData;
    private client: SMTPClient;

    constructor(config: ConfigData) {
        this.config = config;
        this.client = new SMTPClient({
            user: config.email.smtp.user,
            password: config.email.smtp.password,
            host: config.email.smtp.server,
            ssl: true,
            port: config.email.smtp.port
        });
    }

    public async send(to: string, subject: string, text: string, html: string) {
        const mail = new Message({
            "to": to,
            "from": this.config.email.smtp.address,
            "subject": subject,
            "text": text,
            "attachment": [{
                "data": html,
                "alternative": true
            }]
        });

        await this.client.sendAsync(mail);
    }
}