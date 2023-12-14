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

import { syncFolders } from "./sync_folders";
import { copyFiles } from "./copy_files";
import { constants } from "./constants";

/**
 * Folders to mirror into debug folder
 */
const folders = [
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
];

/**
 * Copy some files and sync some folders to debug folder 
 * @param folderName Debug folder name
 * @returns 
 */
export function debug_watch(folderName: string) {
    if(constants.safeFolders.includes(folderName)) {
        console.error("Invalid debug folder name: \"" + folderName + "\"");
        return;
    }

    syncFolders(folders.map(s => { s.dest = folderName + "/" + s.dest; return s; }));
    copyFiles("debug", constants.copy_files);
}

debug_watch("debug");