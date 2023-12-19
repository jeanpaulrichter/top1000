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

import { Plugin, ModuleFormat } from "rollup"

export type Replacement = {
    from: string,
    to: string
}

export type SyncObject = {
    src: string,
    dest: string,
    replace?: Replacement[]
}

export type WatchList = {
    files: SyncObject[],
    dirs: SyncObject[]
}

export type BuildDirectory = {
    src: string
    dest: string
    extensions: string[]
    dest_extension?: string
    transform?: (s: string) => string
}

export type BundleOptions = {
    src: string
    dest: string
    filenames: string[]
    format: ModuleFormat
    plugins?: Plugin[]
    external?: string[]
}
