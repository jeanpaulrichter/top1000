"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.build = void 0;
var url_1 = require("url");
var path_1 = require("path");
var fs_1 = require("fs");
var promises_1 = require("fs/promises");
var uglifycss_1 = require("uglifycss");
var sass_1 = require("sass");
var html_minifier_1 = require("html-minifier");
var rollup_1 = require("rollup");
var plugin_terser_1 = require("@rollup/plugin-terser");
var plugin_typescript_1 = require("@rollup/plugin-typescript");
var plugin_node_resolve_1 = require("@rollup/plugin-node-resolve");
var copy_js_1 = require("./copy.js");
/**
 * Root directory
 */
var rootDir = (0, url_1.fileURLToPath)(new URL('..', import.meta.url));
/**
 * Files to copy to dist folder
 */
var copy_files = [
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
var directories = [
    {
        "src": "frontend/css",
        "dest": "www/css",
        "extensions": [".scss"],
        "dest_extension": ".css",
        "transform": function (s) {
            return (0, uglifycss_1.processString)((0, sass_1.compileString)(s, {
                "sourceMap": false,
                "style": "compressed",
                "loadPaths": ["frontend/css"],
            }).css);
        },
    },
    {
        "src": "frontend/html",
        "dest": "html",
        "extensions": [".html"],
        "transform": function (s) {
            return (0, html_minifier_1.minify)(s, {
                "removeComments": true,
                "collapseWhitespace": true,
            });
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
        "extensions": [".png", ".jpg", ".webp", ".gif"],
    },
];
/**
 * Typescript bundle options
 */
var bundle_options = [
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
            (0, plugin_typescript_1.default)({
                "tsconfig": (0, path_1.join)(rootDir, "frontend/tsconfig.json"),
                "sourceMap": false,
                "inlineSourceMap": false,
                "inlineSources": false,
            }),
            (0, plugin_node_resolve_1.nodeResolve)({
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
            (0, plugin_typescript_1.default)({
                "tsconfig": (0, path_1.join)(rootDir, "backend/tsconfig.json"),
                "outDir": undefined,
                "sourceMap": false,
                "inlineSourceMap": false,
                "inlineSources": false
            }),
        ],
    },
];
/**
 * Create minified release folder
 *
 * @param dir BuildDirectory options
 */
function processDirectory(targetDir, dir) {
    return __awaiter(this, void 0, void 0, function () {
        var destDir, srcDir, srcFiles, promises, destFiles, _i, srcFiles_1, file, srcExtension, srcFile, destFilename, destFile;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    destDir = (0, path_1.join)(rootDir, targetDir, dir.dest);
                    return [4 /*yield*/, (0, promises_1.mkdir)(destDir, { recursive: true })];
                case 1:
                    _a.sent();
                    srcDir = (0, path_1.join)(rootDir, dir.src);
                    return [4 /*yield*/, (0, promises_1.readdir)(srcDir, { withFileTypes: true })];
                case 2:
                    srcFiles = _a.sent();
                    promises = [];
                    destFiles = [];
                    for (_i = 0, srcFiles_1 = srcFiles; _i < srcFiles_1.length; _i++) {
                        file = srcFiles_1[_i];
                        srcExtension = (0, path_1.extname)(file.name);
                        if (!file.isFile() || (dir.extensions.length > 0 && !dir.extensions.includes(srcExtension))) {
                            console.log('Unexpected item: "' + file.name + '" in ' + dir.src);
                            continue;
                        }
                        srcFile = (0, path_1.join)(srcDir, file.name);
                        destFilename = dir.dest_extension ? (0, path_1.basename)(file.name, srcExtension) + dir.dest_extension : file.name;
                        destFile = (0, path_1.join)(destDir, destFilename);
                        destFiles.push((0, path_1.join)(targetDir, dir.dest, destFilename).replace(/\\/gi, "/"));
                        if (dir.transform) {
                            promises.push((0, promises_1.writeFile)(destFile, dir.transform((0, fs_1.readFileSync)(srcFile).toString())));
                        }
                        else {
                            promises.push((0, promises_1.copyFile)(srcFile, destFile));
                        }
                    }
                    return [4 /*yield*/, Promise.allSettled(promises).then(function (results) {
                            for (var i = 0; i < results.length; i++) {
                                if (results[i].status === "rejected") {
                                    console.log("Failed to create \"" + destFiles[i] + "\"");
                                    console.error(results[i].reason);
                                }
                                else {
                                    console.log("Created \"" + destFiles[i] + "\"");
                                }
                            }
                        })];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Bundle typescript sources
 *
 * @param options Bundle options
 */
function processTypescript(targetDir, options) {
    return __awaiter(this, void 0, void 0, function () {
        var destDir, srcDir, bundle;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    destDir = (0, path_1.join)(rootDir, targetDir, options.dest);
                    return [4 /*yield*/, (0, promises_1.mkdir)(destDir, { recursive: true })];
                case 1:
                    _a.sent();
                    srcDir = (0, path_1.join)(rootDir, options.src);
                    return [4 /*yield*/, (0, rollup_1.rollup)({
                            "input": options.filenames.map(function (x) { return (0, path_1.join)(srcDir, x); }),
                            "plugins": options.plugins,
                            "external": options.external,
                            "output": {
                                "sourcemap": false
                            },
                        })];
                case 2:
                    bundle = _a.sent();
                    return [4 /*yield*/, bundle.write({
                            "dir": destDir,
                            "format": options.format,
                            "plugins": [
                                (0, plugin_terser_1.default)({
                                    "format": {
                                        "comments": false,
                                    },
                                }),
                            ],
                            "sourcemap": false,
                        })];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// -----------------------------------------------------------------------------------------------------------------------------
function build(targetDir) {
    console.time("time");
    var distFolder = (0, path_1.join)(rootDir, targetDir);
    if ((0, fs_1.existsSync)(distFolder)) {
        (0, fs_1.rmSync)(distFolder, { recursive: true });
        console.log("Deleted \"" + targetDir + "\"");
    }
    var promises = [];
    var _loop_1 = function (dir) {
        promises.push(processDirectory(targetDir, dir).catch(function () {
            console.error("Failed to process folder \"" + dir.src + "\"");
        }));
    };
    for (var _i = 0, directories_1 = directories; _i < directories_1.length; _i++) {
        var dir = directories_1[_i];
        _loop_1(dir);
    }
    promises.push((0, copy_js_1.copyFiles)(targetDir, copy_files).catch(function () {
        console.error("Failed to copy files.");
    }));
    var _loop_2 = function (options) {
        console.log("Starting to bundle \"" + options.src + "\"...");
        promises.push(processTypescript(targetDir, options)
            .then(function () {
            console.log("Finished bundling \"" + options.src + "\"");
        })
            .catch(function (err) {
            console.error("Failed to bundle \"" + options.src + "\"");
            console.error(err);
        }));
    };
    for (var _a = 0, bundle_options_1 = bundle_options; _a < bundle_options_1.length; _a++) {
        var options = bundle_options_1[_a];
        _loop_2(options);
    }
    Promise.allSettled(promises).then(function () {
        console.timeEnd("time");
    });
}
exports.build = build;
build("dist");
