// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fsapi from 'fs-extra';

export async function getFileInfo(filePath: string): Promise<{ctime:number, mtime:number}> {
    const data = await fsapi.lstat(filePath);
    return {
        ctime: data.ctime.valueOf(),
        mtime: data.mtime.valueOf(),
    };
}

export async function resolveSymbolicLink(filepath:string): Promise<string> {
    const stats = await fsapi.lstat(filepath);
    if (stats.isSymbolicLink()) {
        const link = await fsapi.readlink(filepath);
        return resolveSymbolicLink(link);
    }
    return filepath;
}
