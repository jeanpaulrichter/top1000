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

const path = require("path");
const fs = require("fs");
const uglifycss = require("uglifycss");
const rollup = require("rollup");
const terser = require("@rollup/plugin-terser");
const typescript = require("@rollup/plugin-typescript");
const sass = require("sass");
const htmlminify = require('html-minifier').minify;

const rootPath = path.join(__dirname, "..");
const releasePath = path.join(rootPath, "built");
const frontendPath = path.join(rootPath, "frontend");
const backendPath = path.join(rootPath, "backend");

function processCSS() {
    const targetPath = path.join(releasePath, "www/css");
    fs.mkdirSync(targetPath, { recursive: true });

    const srcPath = path.join(frontendPath, "css");
    
    // Uglify css files and write result to built folder
    let srcFilenames = fs.readdirSync(srcPath, { withFileTypes: true });
    for(let i = 0; i < srcFilenames.length; i++) {
        if(srcFilenames[i].isFile()) {
            const extension = path.extname(srcFilenames[i].name);
            if(!(extension === ".scss" || extension === ".css")) {
                continue;
            }
            const srcFile = path.join(srcPath, srcFilenames[i].name);
            const tFilename = path.basename(srcFilenames[i].name, extension) + ".css";
            const tFile = path.join(targetPath, tFilename);

            let uglified;
            if(extension === ".scss") {
                uglified = uglifycss.processString(sass.compile(srcFile, {"sourceMap": false, "style": "compressed"}).css.toString());
            } else if(extension === ".css") {
                uglified = uglifycss.processFiles([srcFile]);
            }
            fs.writeFileSync(tFile, uglified);
            console.log("Created \"" + tFile.toString() + "\"");
        }
    }

    // Copy CSS files of libraries
    const srcPath_lib = path.join(srcPath, "lib");
    const outPath_lib = path.join(targetPath, "lib");
    fs.mkdirSync(outPath_lib);
    srcFilenames = fs.readdirSync(srcPath_lib, { withFileTypes: true });
    for(let i = 0; i < srcFilenames.length; i++) {
        if(srcFilenames[i].isFile()) {
            const extension = path.extname(srcFilenames[i].name);
            if(extension === ".css") {
                const tFile = path.join(outPath_lib, srcFilenames[i].name);
                fs.copyFileSync(path.join(srcPath_lib, srcFilenames[i].name), tFile);
                console.log("Created \"" + tFile.toString() + "\"");
            }
        }
    }
}

function processHTML() {
    const targetPath = path.join(releasePath, "html");
    fs.mkdirSync(targetPath, { recursive: true });

    const src_dir = path.join(frontendPath, "html");
    let temp = fs.readdirSync(src_dir, { "withFileTypes": true });
    for(let i = 0; i < temp.length; i++) {
        if(temp[i].isFile()) {
            const tFile = path.join(targetPath, temp[i].name);
            const uglified = htmlminify(fs.readFileSync(path.join(src_dir, temp[i].name)).toString(), {
                "removeComments": true,
                "collapseWhitespace": true
            });
            fs.writeFileSync(tFile, uglified);
            
        }
    }
}

function processIcons() {
    const targetPath = path.join(releasePath, "www/css/icons");
    fs.mkdirSync(targetPath, {recursive: true});

    let src_dir = path.join(frontendPath, "icons");

    let temp = fs.readdirSync(src_dir, { "withFileTypes": true });
    for(let i = 0; i < temp.length; i++) {
        if(temp[i].isFile()) {
            const tFile = path.join(targetPath, temp[i].name);
            fs.copyFileSync(path.join(src_dir, temp[i].name), tFile);
            console.log("Created \"" + tFile.toString() + "\"");
        }
    }    
}

function processImages() {
    const targetPath = path.join(releasePath, "www/images");
    fs.mkdirSync(targetPath, {recursive: true});

    let src_dir = path.join(frontendPath, "images");

    let temp = fs.readdirSync(src_dir, { "withFileTypes": true });
    for(let i = 0; i < temp.length; i++) {
        if(temp[i].isFile()) {
            const tFile = path.join(targetPath, temp[i].name);
            fs.copyFileSync(path.join(src_dir, temp[i].name), tFile);
            console.log("Created \"" + tFile.toString() + "\"");
        }
    }    
}

function processJSLibs() {
    const targetPath = path.join(releasePath, "www/javascript/lib");
    fs.mkdirSync(targetPath, {recursive: true});

    let src_dir = path.join(frontendPath, "src/lib");

    let temp = fs.readdirSync(src_dir, { "withFileTypes": true });
    for(let i = 0; i < temp.length; i++) {
        if(temp[i].isFile()) {
            const extension = path.extname(temp[i].name);
            if(extension === ".js") {
                const tFile = path.join(targetPath, temp[i].name);
                fs.copyFileSync(path.join(src_dir, temp[i].name), tFile);
                console.log("Created \"" + tFile.toString() + "\"");
            }
        }
    }
}

async function processFrontend() {
    const targetPath = path.join(releasePath, "www/javascript");
    fs.mkdirSync(targetPath, {recursive: true});

    let src_dir = path.join(frontendPath, "src");

    let temp = fs.readdirSync(src_dir, { "withFileTypes": true });
    for(let i = 0; i < temp.length; i++) {
        if(temp[i].isFile()) {
            const tFile = path.join(targetPath, path.basename(temp[i].name, ".ts") + ".js");
            const bundle = await rollup.rollup({
                "input": path.join(src_dir, temp[i].name),
                "plugins": [typescript({
                    "tsconfig": path.join(frontendPath, "tsconfig.json"),
                    "sourceMap": false,
                    "mapRoot": undefined
                })]
            });
            await bundle.write({
                "file": tFile,
                "format": "iife",
                "plugins": [terser.default({
                    "format": {
                        "comments": false
                    }
                })],
                "sourcemap": false
            });
            console.log("Created \"" + tFile + "\"");
        }
    }
}

async function processBackend() {
    const targetPath = path.join(releasePath, "src");
    fs.mkdirSync(targetPath, {recursive: true});
    const tFile = path.join(targetPath, "index.js");

    const bundle = await rollup.rollup({
        "input": path.join(backendPath, "src/index.ts"),
        "plugins": [ typescript({
            "tsconfig": path.join(backendPath, "tsconfig.json"),
            "module": "esnext",
            "sourceMap": false
        })],
        "external": ["mongodb", "connect-mongo", "@json2csv/plainjs", "nodemailer", "sharp", "path", "fs", "fs/promises", "file-type", "image-size", "http", "express", "express-session", "winston", "crypto", "axios"]
    });
    await bundle.write({
        "file": tFile,
        "format": "cjs",
        "plugins": [terser.default({
            "format": {
                "comments": false
            }
        })],
        "sourcemap": false
    });
    console.log("Created \"" + tFile + "\"");
}

try {
    if(fs.existsSync(releasePath)) {
        fs.rmSync(releasePath, { recursive: true });
        console.log("Deleted \"" + releasePath + "\"");
    }
    fs.mkdirSync(releasePath, {recursive: true});

    processHTML();
    processCSS();
    processIcons();
    processImages();
    processJSLibs();
    processFrontend().then(() => {
        return processBackend();
    }).then(() => {
        console.log("Done");
    }).catch(exc => {
        console.error(exc);
    });
} catch (err) {
    console.error(err);
}