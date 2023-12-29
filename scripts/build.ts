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

import { fileURLToPath } from "url"
import { join, extname, basename } from "path"
import { readFileSync, existsSync, rmSync } from "fs"
import { mkdir, readdir, writeFile, copyFile } from "fs/promises"
import { processString as uglifycss } from "uglifycss"
import { compileString as sass } from "sass"
import { minify as htmlminify } from "html-minifier"
import { rollup } from "rollup"
import { default as terser } from "@rollup/plugin-terser"
import { default as typescript } from "@rollup/plugin-typescript"
import { nodeResolve } from "@rollup/plugin-node-resolve"
import { copyFiles } from "./copy.js"
import { BuildDirectory, BundleOptions } from "./types.js"

/**
 * Root directory
 */
const rootDir = fileURLToPath(new URL('..', import.meta.url));

/**
 * Files to copy to dist folder
 */
const copy_files = [
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
];

/**
 * Directories that need processing
 */
const directories: BuildDirectory[] = [
    {
        "src": "frontend/css",
        "dest": "www/css",
        "extensions": [".scss"],
        "dest_extension": ".css",
        "transform": (s) => {
            return uglifycss(
                sass(s, {
                    "sourceMap": false,
                    "style": "compressed",
                    "loadPaths": ["frontend/css"],
                }).css
            )
        },
    },
    {
        "src": "frontend/html",
        "dest": "html",
        "extensions": [".html"],
        "transform": (s) => {
            return htmlminify(s, {
                "removeComments": true,
                "collapseWhitespace": true,
            })
        },
    },
    {
        "src": "frontend/icons",
        "dest": "www/css/icons",
        "extensions": [".svg", ".png"],
    },
    {
        "src": "frontend/images",
        "dest": "www/images",
        "extensions": [".png", ".jpg", ".webp", ".gif", ".svg"],
    },
]

/**
 * Typescript bundle options
 */
const bundle_options: BundleOptions[] = [
    {
        "src": "frontend/src",
        "dest": "www/javascript",
        "filenames": [
            "list.ts",
            "login.ts",
            "password.ts",
            "register.ts",
            "reset.ts",
            "vote.ts",
        ],
        "format": "esm",
        "plugins": [
            typescript({
                "tsconfig": join(rootDir, "frontend/tsconfig.json"),
                "sourceMap": false,
                "inlineSourceMap": false,
                "inlineSources": false,
            }),
            nodeResolve({
                "browser": true,
            })
        ],
    },
    {
        "src": "backend/src",
        "dest": "",
        "filenames": ["server.ts"],
        "format": "esm",
        "external": [
            "mongodb",
            "connect-mongo",
            "@json2csv/plainjs",
            "emailjs",
            "sharp",
            "path",
            "url",
            "fs",
            "fs/promises",
            "image-size",
            "image-type",
            "http",
            "express",
            "express-session",
            "winston",
            "crypto",
            "axios",
        ],
        "plugins": [
            typescript({
                "tsconfig": join(rootDir, "backend/tsconfig.json"),
                "outDir": undefined,
                "sourceMap": false,
                "inlineSourceMap": false,
                "inlineSources": false
            }),
        ],
    },
]

/**
 * Create minified release folder
 * 
 * @param dir BuildDirectory options
 */
async function processDirectory(targetDir: string, dir: BuildDirectory) {
    const destDir = join(rootDir, targetDir, dir.dest);
    await mkdir(destDir, { recursive: true });

    const srcDir = join(rootDir, dir.src);
    const srcFiles = await readdir(srcDir, { withFileTypes: true });

    const promises: Promise<void>[] = [];
    const destFiles: string[] = [];

    for(const file of srcFiles) {
        const srcExtension = extname(file.name);
        if(!file.isFile() || (dir.extensions.length > 0 && !dir.extensions.includes(srcExtension))) {
            console.log('Unexpected item: "' + file.name + '" in ' + dir.src);
            continue;
        }

        const srcFile = join(srcDir, file.name);
        const destFilename = dir.dest_extension ? basename(file.name, srcExtension) + dir.dest_extension : file.name;
        const destFile = join(destDir, destFilename);
        destFiles.push(join(targetDir, dir.dest, destFilename).replace(/\\/gi, "/"));

        if(dir.transform) {
            promises.push(writeFile(destFile, dir.transform(readFileSync(srcFile).toString())));
        } else {
            promises.push(copyFile(srcFile, destFile));
        }
    }

    await Promise.allSettled(promises).then((results) => {
        for(let i = 0; i < results.length; i++) {
            if(results[i].status === "rejected") {
                console.log("Failed to create \"" + destFiles[i] + "\"");
                console.error((results[i] as PromiseRejectedResult).reason);
            } else {
                console.log("Created \"" + destFiles[i] + "\"");
            }
        }
    })
}

/**
 * Bundle typescript sources
 * 
 * @param options Bundle options
 */
async function processTypescript(targetDir: string, options: BundleOptions) {
    const destDir = join(rootDir, targetDir, options.dest);
    await mkdir(destDir, { recursive: true });
    const srcDir = join(rootDir, options.src);

    const bundle = await rollup({
        "input": options.filenames.map((x) => join(srcDir, x)),
        "plugins": options.plugins,
        "external": options.external,
        "output": {
            "sourcemap": false
        },
    });

    await bundle.write({
        "dir": destDir,
        "format": options.format,
        "plugins": [
            terser({
                "format": {
                    "comments": false,
                },
            }),
        ],
        "sourcemap": false,
    });
}

// -----------------------------------------------------------------------------------------------------------------------------

export function build(targetDir: string) {
    console.time("time");

    const distFolder = join(rootDir, targetDir);
    
    if(existsSync(distFolder)) {
        rmSync(distFolder, { recursive: true });
        console.log("Deleted \"" + targetDir + "\"");
    }
    
    const promises: Promise<void>[] = [];
    
    for(const dir of directories) {
        promises.push(
            processDirectory(targetDir, dir).catch(() => {
                console.error("Failed to process folder \"" + dir.src + "\"");
            })
        );
    }
    
    promises.push(
        copyFiles(targetDir, copy_files).catch(() => {
            console.error("Failed to copy files.");
        })
    );
    
    for(const options of bundle_options) {
        console.log("Starting to bundle \"" + options.src + "\"...")
        promises.push(
            processTypescript(targetDir, options)
                .then(() => {
                    console.log("Finished bundling \"" + options.src + "\"");
                })
                .catch((err) => {
                    console.error("Failed to bundle \"" + options.src + "\"");
                    console.error(err);
                })
        );
    }
    
    Promise.allSettled(promises).then(() => {
        console.timeEnd("time");
    });
}

build("dist");