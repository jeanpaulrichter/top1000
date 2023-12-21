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

import { SyncManager } from "./sync.js";

new SyncManager("debug").sync([
    {
        "src": "frontend/icons",
        "dest": "www/css/icons"
    },
    {
        "src": "frontend/html",
        "dest": "html"
    },
    {
        "src": "frontend/images",
        "dest": "www/images"
    },
    {
        "src": "config.json",
        "dest": "config.json"
    },
    {
        "src": "node_modules/jquery/dist/jquery.min.js",
        "dest": "www/javascript/jquery.js",
    },
    {
        "src": "node_modules/select2/dist/js/select2.min.js",
        "dest": "www/javascript/select2.js"
    },
    {
        "src": "node_modules/select2/dist/css/select2.min.css",
        "dest": "www/css/select2.css"
    }
]);
