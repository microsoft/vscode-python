// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { logError } from '../../logging';
import { getOSType, OSType } from './platform';

/**
 * Produce a uniform representation of the given filename.
 *
 * The result is especially suitable for cases where a filename is used
 * as a key (e.g. in a mapping).
 */
export function normalizeFilename(filename: string): string {
    // `path.resolve()` returns the absolute path.  Note that it also
    // has the same behavior as `path.normalize()`.
    const resolved = path.resolve(filename);
    return getOSType() === OSType.Windows ? resolved.toLowerCase() : resolved;
}

/**
 * Decide if the two filenames are the same file.
 *
 * This only checks the filenames (after normalizing) and does not
 * resolve symlinks or other indirection.
 */
export function areSameFilename(filename1: string, filename2: string): boolean {
    const norm1 = normalizeFilename(filename1);
    const norm2 = normalizeFilename(filename2);
    return norm1 === norm2;
}

export import FileType = vscode.FileType;

export type DirEntry = {
    filename: string;
    filetype: FileType;
};

interface IKnowsFileType {
    isFile(): boolean;
    isDirectory(): boolean;
    isSymbolicLink(): boolean;
}

// This helper function determines the file type of the given stats
// object.  The type follows the convention of node's fs module, where
// a file has exactly one type.  Symlinks are not resolved.
export function convertFileType(info: IKnowsFileType): FileType {
    if (info.isFile()) {
        return FileType.File;
    }
    if (info.isDirectory()) {
        return FileType.Directory;
    }
    if (info.isSymbolicLink()) {
        // The caller is responsible for combining this ("logical or")
        // with File or Directory as necessary.
        return FileType.SymbolicLink;
    }
    return FileType.Unknown;
}

/**
 * Identify the file type for the given file.
 */
export async function getFileType(
    filename: string,
    opts: {
        ignoreErrors: boolean;
    } = { ignoreErrors: true },
): Promise<FileType | undefined> {
    let stat: fs.Stats;
    try {
        stat = await fs.promises.lstat(filename);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return undefined;
        }
        if (opts.ignoreErrors) {
            logError(`lstat() failed for "${filename}" (${err})`);
            return FileType.Unknown;
        }
        throw err; // re-throw
    }
    return convertFileType(stat);
}
