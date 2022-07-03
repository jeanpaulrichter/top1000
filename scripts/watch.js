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

/*
    This script is used to mirror certain folders into the "debug" folder during development
*/

const path = require("path");
const chokidar = require("chokidar");
const { copyFileSync, unlinkSync, mkdirSync } = require("fs");

/* ------------------------------------------------------------------------------------------------------------------------------------------ */
// Folders to watch
const folders = [
    {
        "from": "frontend/icons",
        "to": "debug/www/css/icons"
    },
    {
        "from": "frontend/html",
        "to": "debug/html"
    },
    {
        "from": "frontend/images",
        "to": "debug/www/images"
    },
    {
        "from": "frontend/src/lib",
        "to": "debug/www/javascript/lib"
    }
];

/* ------------------------------------------------------------------------------------------------------------------------------------------ */

function getSourceFolder(file) {
    const fp = path.dirname(file);

    for(let i = 0; i < folders.length; i++) {
        if(fp.length > folders[i].from.length && fp.substring(fp.length - folders[i].from.length).replace(/\\/g, "/") === folders[i].from) {
            return i;
        }
    }

    return -1;
}

function onChangeFile(file) {
    try {
        const index = getSourceFolder(file);
        if(index >= 0) {
            const filename = path.basename(file);
            copyFileSync(file, path.join(folders[index].to, filename));
            console.log("Copied \"" + filename + "\" to \"" + folders[index].to + "\"");
        } else {
            console.log("Unexpected file: " + file);
        }
    } catch(exc) {
        console.error(exc.message);
    }
}

function onDeleteFile(file) {
    try {
        const index = getSourceFolder(file);
        if(index >= 0) {
            const filename = path.basename(file);
            const target = path.join(folders[index].to, filename);
            unlinkSync(target);
            console.log("Deleted \"" + target + "\"");
        } else {
            console.log("Unexpected file: " + file);
        }
    } catch(exc) {
        console.error(exc.message);
    }
}

/* ------------------------------------------------------------------------------------------------------------------------------------------ */

// Setup chokidar
const watch_files = chokidar.watch([], {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    followSymlinks: false,
    ignoreInitial: false,
    depth: 0
});
watch_files.on("add", onChangeFile);
watch_files.on("change", onChangeFile);
watch_files.on("unlink", onDeleteFile);

for(let i = 0; i < folders.length; i++) {
    // Create target folder
    mkdirSync(path.join(__dirname, "..", folders[i].to), { recursive: true });
    // Add source folders to chokidar
    watch_files.add(path.join(__dirname, "..", folders[i].from));
    console.log("Watching \"" + folders[i].from + "\"...");
}