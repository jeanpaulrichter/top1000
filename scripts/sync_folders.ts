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

import { FSWatcher, watch } from "chokidar";
import { dirname, join, basename } from "path";
import { mkdirSync, existsSync } from "fs";
import { copyFile, unlink } from "fs/promises";

type SyncFolder = {
    src: string,
    dest: string
}

// Chokidar instance
let chokidar: undefined | FSWatcher = undefined;
// All watched folders by chokidar instance
const chokidar_folders: SyncFolder[] = [];

/**
 * Returns the destination folder for source file.
 * @param file Source file path
 * @returns Destination folder
 * @throws Error (Should not happen :)
 */
function getDestinationFolder(file: string): string {
    const curFolder = dirname(file);

    for(const folder of chokidar_folders) {
        if(curFolder.length > folder.src.length && curFolder.substring(curFolder.length - folder.src.length).replace(/\\/g, "/") === folder.src) {
            return folder.dest;
        }
    }

    throw new Error("Failed to find destination folder of: \"" + file + "\"");
}

/**
 * Chokidar change event handler: Copies file to destination folder
 * @param file Changed file in source folder
 */
function onChangeFile(file: string): void {
    try {
        const destFolder = getDestinationFolder(file);
        const filename = basename(file);
        const destFile = join(__dirname, "..", destFolder, filename);

        copyFile(file, destFile).then(() => {
            console.log("Copied \"" + filename + "\" to \"" + destFolder + "\"");
        }).catch(err => {
            console.error("Failed to copy \"" + filename + "\" to \"" + destFolder + "\"");
            console.error(err);
        });

    } catch(exc: unknown) {
        console.error(exc instanceof Error ? exc.message: "onChangeFile: Unknown error");
    }
}

/**
 * Chokidar delete event handler: Deletes file from destination folder
 * @param file Deleted file in source folder
 */
function onDeleteFile(file: string) {
    try {
        const destFolder = getDestinationFolder(file);
        const filename = basename(file);
        const destFile = join(__dirname, "..", destFolder, filename);

        unlink(destFile).then(() => {
            console.log("Deleted \"" + destFolder + "/" + filename + "\"");
        }).catch(err => {
            console.error("Failed to delete \"" + filename + "\" from \"" + destFolder + "\"");
            console.error(err);
        });        

    } catch(exc: unknown) {
        console.error(exc instanceof Error ? exc.message: "onDeleteFile: Unknown error");
    }
}

/**
 * Adds folders to sync list
 * @param folders Folders to watch
 */
export function syncFolders(folders: SyncFolder[]) {

    // Initialize chokidar if neccessary
    if(chokidar === undefined) {
        chokidar = watch([], {
            ignored: /(^|[\/\\])\../,
            persistent: true,
            followSymlinks: false,
            ignoreInitial: false,
            depth: 0,
        });
        chokidar.on("add", onChangeFile);
        chokidar.on("change", onChangeFile);
        chokidar.on("unlink", onDeleteFile);
    }

    for(const folder of folders) {
        const srcFolder = join(__dirname, "..", folder.src);
        const destFolder = join(__dirname, "..", folder.dest);

        if(!existsSync(destFolder)) {
            mkdirSync(destFolder, { recursive: true });
        }

        chokidar.add(srcFolder);
        chokidar_folders.push(folder);
        console.log("Watching \"" + folder.src + "\"...");
    }
}
