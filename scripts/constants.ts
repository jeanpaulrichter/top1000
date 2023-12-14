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

import { FileCopy } from "./copy_files";
import { join } from "path";

type Constants = {
    rootFolder: string,
    safeFolders: string[],
    copy_files: FileCopy[]
}

export const constants: Constants = {
    "rootFolder": join(__dirname, ".."),
    "safeFolders": [".vscode", "backend", "frontend", "node_modules", "scripts"],
    "copy_files": [
        {
            "src": "node_modules/jquery/dist/jquery.min.js",
            "dest": "www/javascript/jquery.js",
        },
        {
            "src": "node_modules/select2/dist/js/select2.min.js",
            "dest": "www/javascript/select2.js"
        },
        {
            "src": "node_modules/bootstrap/dist/css/bootstrap.min.css",
            "dest": "www/css/bootstrap.css",
            "replace": [
                {
                    "from": "/*# sourceMappingURL=bootstrap.min.css.map */",
                    "to": ""
                }
            ]
        },
        {
            "src": "node_modules/select2/dist/css/select2.min.css",
            "dest": "www/css/select2.css"
        }
    ]
};