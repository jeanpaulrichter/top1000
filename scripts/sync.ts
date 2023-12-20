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
import { mkdirSync, existsSync, lstatSync } from "fs";
import { fileURLToPath } from "url";
import { copyFile, unlink } from "fs/promises";
import { SyncObject, WatchList } from "./types.js";
import { copy } from "./copy.js";

export class SyncManager {
    /**
     * Project root directory
     */
    private rootDir: string;
    /**
     * Name of sync target dir ie. "debug"
     */
    private targetDir: string;

    /**
     * Chokidar instance
     */
    private chokidar: FSWatcher;

    /**
     * All watched files and directories
     */
    private watchlist: WatchList;

    constructor(targetDir: string) {
        this.rootDir = fileURLToPath(new URL('..', import.meta.url));
        this.targetDir = targetDir;
        this.chokidar = watch([], {
            ignored: /(^|[/\\])\../,
            persistent: true,
            followSymlinks: false,
            ignoreInitial: false,
            depth: 0,
        });
        this.watchlist = {
            "files": [],
            "dirs": []
        };

        this.chokidar.on("add", this.onChangeFile.bind(this));
        this.chokidar.on("change", this.onChangeFile.bind(this));
        this.chokidar.on("unlink", this.onDeleteFile.bind(this));
    }

    /**
     * Adds objects to watch list
     * 
     * @param objects Files/Folders to watch
     */
    public sync(objs: SyncObject[]) {
        for(const obj of objs) {
            try {
                const stat = lstatSync(obj.src, { "throwIfNoEntry": true });
                let destDir;
                if(stat.isDirectory()) {
                    const srcDir = join(this.rootDir, obj.src);
                    destDir = join(this.rootDir, this.targetDir, obj.dest);
                    this.watchlist.dirs.push(obj);
                    this.chokidar.add(srcDir);
                } else if(stat.isFile()) {
                    destDir = dirname(join(this.rootDir, this.targetDir, obj.dest));
                    this.watchlist.files.push(obj);
                    this.chokidar.add(obj.src);
                } else {
                    throw new Error("Is neither file nor directory");
                }
                if(!existsSync(destDir)) {
                    mkdirSync(destDir, { recursive: true });
                }

                console.log("Watching \"" + obj.src + "\"...");
            } catch(err) {
                if(err instanceof Error) {
                    console.error("Failed to add \"" + obj.src + "\" to watchlist: " + err.message);
                } else {
                    console.error("Failed to add \"" + obj.src + "\" to watchlist");
                }            
            }
        }
    }

    /**
     * Get SyncObject from file path, if file is part of watchlist.files
     * 
     * @param file Full file path
     * @returns SyncObject or undefined
     */
    private getSyncFile(file: string): SyncObject | undefined {
        for(const watched_file of this.watchlist.files) {
            if(file.replace(/\\/g, "/").includes(watched_file.src)) {
                return watched_file;
            }
        }
        return undefined;
    }

    /**
     * Get SyncObject from file path, if file is part of watchlist.dirs
     * 
     * @param file Full file path
     * @returns SyncObject or undefined
     */
    private getSyncDir(file: string): SyncObject | undefined {
        const fileDir = dirname(file);

        for(const watched_dir of this.watchlist.dirs) {
            if(fileDir.length > watched_dir.src.length) {
                let compare_str = fileDir.substring(fileDir.length - watched_dir.src.length);
                compare_str = compare_str.replace(/\\/g, "/");
                if(compare_str === watched_dir.src) {
                    return watched_dir;
                }
            }
        }
        return undefined;
    }

    /**
     * Chokidar change event handler: Copies files to destination
     * 
     * @param file Changed file
     */
    private onChangeFile(file: string): void {        
        try {
            let promise: Promise<void>;
            let tPath: string;
            
            const syncFile = this.getSyncFile(file);
            if(syncFile !== undefined) {
                const destFile = join(this.rootDir, this.targetDir, syncFile.dest);
                tPath = join(this.targetDir, syncFile.dest).replace(/\\/g, "/");
                promise = copy(file, destFile, syncFile.replace);
            } else {
                const syncDir = this.getSyncDir(file);
                if(syncDir === undefined) {
                    throw new Error();
                }
                const filename = basename(file);
                const destDir = join(this.targetDir, syncDir.dest);
                const destFile = join(this.rootDir, destDir, filename);
                tPath = join(destDir, filename).replace(/\\/g, "/");

                promise = copyFile(file, destFile);
            }
            promise.then(() => {
                console.log("Created \"" + tPath + "\"");
            }).catch(err => {
                console.error("Failed to create \"" + tPath + "\"");
                console.error(err);
            });
        } catch {
            console.error("Unexpected file change: \"" + file + "\"");
        }
    }

    /**
     * Chokidar delete event handler: Deletes file from destination folder
     * 
     * @param file Deleted file in source folder
     */
    private onDeleteFile(file: string) {
        if(this.getSyncFile(file) !== undefined) {
            console.log("Unexpected: \"" + file + "\" was deleted!");
        } else {
            const syncDir = this.getSyncDir(file);
            if(syncDir === undefined) {
                console.error("Unexpected file deletion: \"" + file + "\"");
            } else {
                const filename = basename(file);
                const destDir = join(this.targetDir, syncDir.dest);
                const destFile = join(this.rootDir, destDir, filename);
                const destDir_s = destDir.replace(/\\/g, "/");

                unlink(destFile).then(() => {
                    console.log("Deleted \"" + filename + "\" from \"" + destDir_s + "\"");
                }).catch(err => {
                    console.error("Failed to delete \"" + filename + "\" from \"" + destDir_s + "\"");
                    console.error(err);
                });
            }
        }
    }
}
