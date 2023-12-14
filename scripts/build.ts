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

import { join, extname, basename } from "path";
import { readFileSync, existsSync, rmSync } from "fs";
import { mkdir, readdir,  writeFile, copyFile } from "fs/promises";
import { processString as uglifycss } from "uglifycss";
import { compileString as sass } from "sass";
import { minify as htmlminify } from "html-minifier";
import { rollup, Plugin, ModuleFormat } from "rollup";
import { default as terser } from "@rollup/plugin-terser";
import { default as typescript } from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { copyFiles } from "./copy_files";
import { constants } from "./constants";

type BuildFolder = {
    "src": string,
    "dest": string,
    "extensions": string[],
    "dest_extension"?: string,
    "transform"?: (s: string) => string;
}

type CompileOptions = {
    src: string,
    dest: string,
    filenames: string[],
    format: ModuleFormat,
    plugins?: Plugin[],
    external?: string[]
}

/**
 * Release folders
 */
const folders: BuildFolder[] = [
    {
        "src": "frontend/css",
        "dest": "www/css",
        "extensions": [".scss"],
        "dest_extension": ".css",
        "transform": (s) => {
            return uglifycss(sass(s, {"sourceMap": false, "style": "compressed", "loadPaths": ["frontend/css"]}).css);
        }
    },
    {
        "src": "frontend/html",
        "dest": "html",
        "extensions": [".html"],
        "transform": (s) => {
            return htmlminify(s, {
                "removeComments": true,
                "collapseWhitespace": true
            });
        }
    },
    {
        "src": "frontend/icons",
        "dest": "www/css/icons",
        "extensions": [".svg", ".png"]
    },
    {
        "src": "frontend/images",
        "dest": "www/images",
        "extensions": [".png", ".jpg", ".webp", ".gif"]
    }
];

/**
 * Typescript compile/bundle options
 */
const compile_options: CompileOptions[] = [
    {
        "src": "frontend/src",
        "dest": "www/javascript",
        "filenames": ["list.ts", "login.ts", "password.ts", "register.ts", "reset.ts", "vote.ts"],
        "format": "es",
        "plugins": [
            typescript({
                "tsconfig": join(constants.rootFolder, "frontend/tsconfig.json"),
                "sourceMap": false,
                "inlineSourceMap": false,
                "inlineSources": false
            }),
            nodeResolve({
                browser: true
            })]
    },
    {
        "src": "backend/src",
        "dest": "src",
        "filenames": ["index.ts"],
        "format": "cjs",
        "external": ["mongodb", "connect-mongo", "@json2csv/plainjs", "nodemailer", "sharp", "path", "fs", "fs/promises", "file-type", "image-size", "http", "express", "express-session", "winston", "crypto", "axios"],
        "plugins": [
            typescript({
                "tsconfig": join(constants.rootFolder, "backend/tsconfig.json"),
                "module": "esnext",
                "outDir": undefined,
                "sourceMap": false,
                "inlineSourceMap": false,
                "inlineSources": false
            })]
    }
];

/**
 * Create minified release folder
 * @param builddir Build folder name
 * @param folder 
 */
async function processFolder(builddir: string, folder: BuildFolder) {
    const destFolder = join(constants.rootFolder, builddir, folder.dest);
    await mkdir(destFolder, { recursive: true });

    const srcFolder = join(constants.rootFolder, folder.src);
    const srcFiles = await readdir(srcFolder, { withFileTypes: true });

    const promises: Promise<void>[] = [];
    const destFiles: string[] = [];

    for(const file of srcFiles) {
        const srcExtension = extname(file.name);
        if(!file.isFile() || (folder.extensions.length > 0 && !folder.extensions.includes(srcExtension))) {
            console.log("Unexpected item: \"" + file.name + "\" in " + folder.src);
            continue;
        }

        const srcFile = join(srcFolder, file.name);
        const destFilename = folder.dest_extension ? basename(file.name, srcExtension) + folder.dest_extension : file.name;
        const destFile = join(destFolder, destFilename);
        destFiles.push(join(builddir, folder.dest, destFilename));

        if(folder.transform) {
            promises.push(writeFile(destFile, folder.transform(readFileSync(srcFile).toString())));
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

/**
 * Build & Bundle typescript
 * @param builddir Build folder name
 * @param options Build options
 */
async function processTypescript(builddir: string, options: CompileOptions) {
    const destFolder = join(constants.rootFolder, builddir, options.dest);
    await mkdir(destFolder, {recursive: true});
    const srcFolder = join(constants.rootFolder, options.src);

    const bundle = await rollup({
        "input": options.filenames.map((x) => join(srcFolder, x)),
        "plugins": options.plugins,
        "external": options.external,
        "output": { "sourcemap": false }
    });

    await bundle.write({
        "dir": destFolder,
        "format": options.format,
        "plugins": [terser({
            "format": {
                "comments": false
            }
        })],
        "sourcemap": false
    });
}

/**
 * Build everything in release mode
 * @param folderName Build folder name
 */
export function build(folderName: string): void {
    console.time("time");

    if(constants.safeFolders.includes(folderName)) {
        console.error("Invalid build folder name: \"" + folderName + "\"");
        return;
    }

    const distFolder = join(constants.rootFolder, folderName);
    if(existsSync(distFolder)) {
        rmSync(distFolder, { recursive: true });
        console.log("Deleted \"" + folderName + "\"");
    }

    const promises: Promise<void>[] = [];

    for(const folder of folders) {
        promises.push(processFolder(folderName, folder).catch(() => {
            console.error("Failed to process folder \"" + folder.src + "\"");
        }));
    }
    
    promises.push(copyFiles(folderName, constants.copy_files).catch(() => {
        console.error("Failed to copy files.");
    }));

    for(const options of compile_options) {
        console.log("Starting to build \"" + options.src + "\"...");
        promises.push(processTypescript(folderName, options).then(() => {
            console.log("Finished building \"" + options.src + "\".");
        }).catch(err => {
            console.error("Failed to build \"" + options.src + "\".");
            console.error(err);
        }));
    }

    Promise.allSettled(promises).then(res => {
        console.timeEnd("time");
    });
}

try {
    build("dist");
} catch (err) {
    console.error(err);
}