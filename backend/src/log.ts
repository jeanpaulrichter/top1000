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

import { Logger, createLogger, format, transports } from "winston";
import { TransformableInfo } from "logform";
import { dirname, basename } from "path";
import { fileURLToPath } from "url";
import { ConfigData } from "./config";

/**
 * Manages winston logger instance
 */
export class LoggerManager {
    private mlog: Logger;

    constructor(config: ConfigData) {
        // Get log file directory
        let dir = dirname(config.log.file);
        const filename = basename(config.log.file);
        if(dir.length == 0 || dir == ".") {
            dir = fileURLToPath(new URL(".", import.meta.url));
        }

        this.mlog = createLogger({
            format: format.combine(
                format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label', 'module'] })
            ),
            transports: [
                new transports.File({
                    "dirname": dir,
                    "filename": filename,
                    "maxsize": 1000 * config.log.maxsize,
                    "maxFiles": config.log.maxfiles,
                    "tailable": true,
                    "format": format.combine(
                        format.timestamp(),
                        format.json()
                    )
                })
            ]
        });

        // Not in production: Add console transport
        if(process.env.NODE_ENV !== "production") {
            this.mlog.add(new transports.Console({
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
            )}));
        }
    }

    /**
     * Get main logger
     * 
     * @returns Winston logger
     */
    public get(): Logger {
        return this.mlog;
    }

    /**
     * Get child logger for submodule
     * 
     * @param name Module name
     * @returns Winston Logger
     */
    public getChild(name: string) {
        return this.mlog.child({
            "module": name
        });
    }
}
