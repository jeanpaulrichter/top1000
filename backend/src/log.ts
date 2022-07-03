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

import { createLogger, format, transports } from "winston";
import { TransformableInfo } from "logform";
import { join as pathJoin } from "path";

export default createLogger({
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label', 'module'] })
    ),
    transports: [
        new transports.Console({
            "format": format.combine(
                format.timestamp(),
                format.printf((info: TransformableInfo) => {
                    let ret = info.timestamp + " [top1000";
                    if(info.module !== undefined) {
                        ret += ":" + info.module;
                    }
                    ret += "] " + info.level + ": " + info.message;
                    const show_metadata = (Object.keys(info.metadata).length > 0);

                    if(show_metadata) {
                        ret += " " + JSON.stringify(info.metadata);
                    }
                    return ret;
                })
        )}),
        new transports.File({
            "filename": pathJoin(__dirname, "..", "server.log"),
            "format": format.combine(
                format.timestamp(),
                format.json()
            )
        })
    ]
});