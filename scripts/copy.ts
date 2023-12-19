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

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdir, readFile, writeFile, copyFile, lstat } from "fs/promises";
import { existsSync } from "fs";
import { Replacement, SyncObject } from "./types.js";

/**
 * Copy file
 * 
 * @param srcFile Path to file
 * @param destFile Destination path
 * @param replace Replacements
 */
export async function copy(srcFile: string, destFile: string, replace?: Replacement[]) {
    if(replace && replace.length > 0) {
        const srcBuffer = await readFile(srcFile, { "encoding": "utf8"});
        let outBuffer = "";
        let endIndex = 0;

        while(endIndex < srcBuffer.length) {
            let sIndex = Number.MAX_SAFE_INTEGER;
            let rIndex = -1;
            for(let i = 0; i < replace.length; i++) {
                const sIndexTemp = srcBuffer.indexOf(replace[i].from, endIndex);
                if(sIndexTemp != -1 && sIndexTemp < sIndex) {
                    sIndex = sIndexTemp;
                    rIndex = i;
                }
            }
            if(sIndex == Number.MAX_SAFE_INTEGER) {
                break;
            }
            outBuffer += srcBuffer.slice(endIndex, sIndex) + replace[rIndex].to;
            endIndex = sIndex + replace[rIndex].from.length;
        }

        outBuffer += srcBuffer.slice(endIndex, srcBuffer.length);

        await writeFile(destFile, outBuffer);
    } else {
        await copyFile(srcFile, destFile);
    }
}

/**
 * Copy files
 * 
 * @param targetDir Target directory name
 * @param files Files to copy
 */
export async function copyFiles(targetDir: string, files: SyncObject[]) {
    const promises: Promise<void>[] = [];

    const rootDir = fileURLToPath(new URL('..', import.meta.url));

    for(const file of files) {
        try {
            const srcFile = join(rootDir, file.src);
            const destFile = join(rootDir, targetDir, file.dest);

            const srcStat = await lstat(srcFile);
            if(!srcStat.isFile()) {
                throw new Error("Is not a file");
            }

            const destDir = dirname(destFile);
            if(!existsSync(destDir)) {
                await mkdir(destDir, { recursive: true });
            }
            
            promises.push(copy(srcFile, destFile, file.replace));
        } catch(err) {
            if(err instanceof Error) {
                console.error("Failed to copy \"" + file.src + "\": " + err.message);
            } else {
                console.error("Failed to copy \"" + file.src + "\"");
            }            
        }
    }

    await Promise.allSettled(promises).then(results => {
        for(let i = 0; i < results.length; i++) {
            if(results[i].status === "rejected") {
                console.log("Failed to create \"" + targetDir + "/" + files[i].dest + "\"");
                console.error((results[i] as PromiseRejectedResult).reason);
            } else {
                console.log("Created \"" + targetDir + "/" + files[i].dest + "\"");
            }
        }
    });
}
