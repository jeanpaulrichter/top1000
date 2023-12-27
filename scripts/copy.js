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
exports.copyFiles = exports.copy = void 0;
var url_1 = require("url");
var path_1 = require("path");
var promises_1 = require("fs/promises");
var fs_1 = require("fs");
/**
 * Copy file
 *
 * @param srcFile Path to file
 * @param destFile Destination path
 * @param replace Replacements
 */
function copy(srcFile, destFile, replace) {
    return __awaiter(this, void 0, void 0, function () {
        var srcBuffer, outBuffer, endIndex, sIndex, rIndex, i, sIndexTemp;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(replace && replace.length > 0)) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, promises_1.readFile)(srcFile, { "encoding": "utf8" })];
                case 1:
                    srcBuffer = _a.sent();
                    outBuffer = "";
                    endIndex = 0;
                    while (endIndex < srcBuffer.length) {
                        sIndex = Number.MAX_SAFE_INTEGER;
                        rIndex = -1;
                        for (i = 0; i < replace.length; i++) {
                            sIndexTemp = srcBuffer.indexOf(replace[i].from, endIndex);
                            if (sIndexTemp != -1 && sIndexTemp < sIndex) {
                                sIndex = sIndexTemp;
                                rIndex = i;
                            }
                        }
                        if (sIndex == Number.MAX_SAFE_INTEGER) {
                            break;
                        }
                        outBuffer += srcBuffer.slice(endIndex, sIndex) + replace[rIndex].to;
                        endIndex = sIndex + replace[rIndex].from.length;
                    }
                    outBuffer += srcBuffer.slice(endIndex, srcBuffer.length);
                    return [4 /*yield*/, (0, promises_1.writeFile)(destFile, outBuffer)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, (0, promises_1.copyFile)(srcFile, destFile)];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5: return [2 /*return*/];
            }
        });
    });
}
exports.copy = copy;
/**
 * Copy files
 *
 * @param targetDir Target directory name
 * @param files Files to copy
 */
function copyFiles(targetDir, files) {
    return __awaiter(this, void 0, void 0, function () {
        var promises, rootDir, _i, files_1, file, srcFile, destFile, srcStat, destDir, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    promises = [];
                    rootDir = (0, url_1.fileURLToPath)(new URL('..', import.meta.url));
                    _i = 0, files_1 = files;
                    _a.label = 1;
                case 1:
                    if (!(_i < files_1.length)) return [3 /*break*/, 8];
                    file = files_1[_i];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 6, , 7]);
                    srcFile = (0, path_1.join)(rootDir, file.src);
                    destFile = (0, path_1.join)(rootDir, targetDir, file.dest);
                    return [4 /*yield*/, (0, promises_1.lstat)(srcFile)];
                case 3:
                    srcStat = _a.sent();
                    if (!srcStat.isFile()) {
                        throw new Error("Is not a file");
                    }
                    destDir = (0, path_1.dirname)(destFile);
                    if (!!(0, fs_1.existsSync)(destDir)) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, promises_1.mkdir)(destDir, { recursive: true })];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    promises.push(copy(srcFile, destFile, file.replace));
                    return [3 /*break*/, 7];
                case 6:
                    err_1 = _a.sent();
                    if (err_1 instanceof Error) {
                        console.error("Failed to copy \"" + file.src + "\": " + err_1.message);
                    }
                    else {
                        console.error("Failed to copy \"" + file.src + "\"");
                    }
                    return [3 /*break*/, 7];
                case 7:
                    _i++;
                    return [3 /*break*/, 1];
                case 8: return [4 /*yield*/, Promise.allSettled(promises).then(function (results) {
                        for (var i = 0; i < results.length; i++) {
                            if (results[i].status === "rejected") {
                                console.log("Failed to create \"" + targetDir + "/" + files[i].dest + "\"");
                                console.error(results[i].reason);
                            }
                            else {
                                console.log("Created \"" + targetDir + "/" + files[i].dest + "\"");
                            }
                        }
                    })];
                case 9:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
exports.copyFiles = copyFiles;
