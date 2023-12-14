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

import { dirname, join } from "path";
import { mkdir, readFile, writeFile, copyFile } from "fs/promises";

type Replacement = {
    from: string,
    to: string
}

export type FileCopy = {
    src: string,
    dest: string,
    replace?: Replacement[]
}

/**
 * Copy file with replacements
 * @param srcFile Path to file
 * @param destFile Destination path
 * @param replace Replacements
 */
async function transformFile(srcFile: string, destFile: string, replace: Replacement[]) {
    const srcBuffer = await readFile(srcFile, { "encoding": "utf8"});
    let outBuffer = '';
    let endIndex = 0;

    while(true) {
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
}

/**
 * Copy files
 * @param destFolder Destination folder
 * @param files Files to copy
 */
export async function copyFiles(destFolder: string, files: FileCopy[]) {
    const destFiles: string[] = [];
    const promises: Promise<void>[] = [];

    for(const file of files) {
        const srcFile = join(__dirname, "..", file.src);
        const destFile = join(__dirname, "..", destFolder, file.dest);
        destFiles.push(join(destFolder, file.dest));

        try {
            await mkdir(dirname(destFile), { recursive: true });
        } catch {}

        if(file.replace !== undefined && file.replace.length > 0) {
            promises.push(transformFile(srcFile, destFile, file.replace));
        } else {
            promises.push(copyFile(srcFile, destFile));
        }
    }

    await Promise.allSettled(promises).then(results => {
        for(let i = 0; i < results.length; i++) {
            if(results[i].status === "rejected") {
                console.log("Failed to create \"" + destFiles[i] + "\"");
                console.error((results[i] as PromiseRejectedResult).reason);
            } else {
                console.log("Created \"" + destFiles[i] + "\"");
            }
        }
    });
}
