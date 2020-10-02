// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { FileInfo, PythonExecutableInfo } from '.';

/**
 * Make a copy of "executable" and fill in empty properties using "other."
 */
export function mergeExecutables(
    executable: PythonExecutableInfo,
    other: PythonExecutableInfo,
): PythonExecutableInfo {
    const merged: PythonExecutableInfo = {
        ...mergeFileInfo(executable, other),
        sysPrefix: executable.sysPrefix,
    };

    if (executable.sysPrefix === '') {
        merged.sysPrefix = other.sysPrefix;
    }

    return merged;
}

function mergeFileInfo(file: FileInfo, other: FileInfo): FileInfo {
    const merged: FileInfo = {
        filename: file.filename,
        ctime: file.ctime,
        mtime: file.mtime,
    };

    if (file.filename === '') {
        merged.filename = other.filename;
    }

    if (merged.filename === other.filename || other.filename == '') {
        if (file.ctime < 0 && other.ctime > -1) {
            merged.ctime = other.ctime;
        }
        if (file.mtime < 0 && other.mtime > -1) {
            merged.mtime = other.mtime;
        }
    }

    return merged;
}
