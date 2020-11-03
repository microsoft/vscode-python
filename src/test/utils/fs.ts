// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fsapi from 'fs-extra';
import * as path from 'path';
import * as tmp from 'tmp';
import { parseTree } from './text';

export function createTemporaryFile(
    extension: string,
    temporaryDirectory?: string
): Promise<{ filePath: string; cleanupCallback: Function }> {
    // tslint:disable-next-line:no-any
    const options: any = { postfix: extension };
    if (temporaryDirectory) {
        options.dir = temporaryDirectory;
    }

    return new Promise<{ filePath: string; cleanupCallback: Function }>((resolve, reject) => {
        tmp.file(options, (err, tmpFile, _fd, cleanupCallback) => {
            if (err) {
                return reject(err);
            }
            resolve({ filePath: tmpFile, cleanupCallback: cleanupCallback });
        });
    });
}

// Something to consider: we should combine with `createDeclaratively`
// (in src/test/testing/results.ts).

type FileKind = 'dir' | 'file' | 'exe';

function parseFSEntry(
    entry: string,
    opts: {
        topLevel?: boolean;
    } = {}
): [string, FileKind] {
    if (entry.startsWith('/')) {
        throw Error(`expected relative path, got ${entry}`);
    }
    let kind: FileKind;
    let relname: string;
    if (entry.endsWith('/')) {
        kind = 'dir';
        relname = entry.slice(0, -1);
    } else if (opts.topLevel) {
        throw Error(`expected directory at top level, got ${entry}`);
    } else {
        kind = 'file';
        relname = entry;
        if (entry.startsWith('<')) {
            if (!entry.endsWith('>')) {
                throw Error(`bad entry (${entry})`);
            }
            kind = 'exe';
            relname = entry.slice(1, -1);
        }
    }
    if (!opts.topLevel && relname.indexOf('/') !== -1) {
        throw Error(`expected basename only, got ${entry}`);
    }
    return [relname, kind];
}

/**
 * Extract the directory tree represented by the given text.'
 *
 * "/" is the expected path separator, regardless of current OS.
 * Directories always end with "/".  Executables are surrounded
 * by angle brackets "<>".
 */
export function parseFSTree(
    text: string,
    // Use process.cwd() by default.
    cwd?: string
): [string, string, FileKind][] {
    const curDir = cwd ?? process.cwd();
    const parsed: [string, string, FileKind][] = [];

    const entries = parseTree(text);
    entries.forEach((data) => {
        const [entry, parentIndex] = data;
        const opts = { topLevel: parentIndex === -1 };
        const [relname, kind] = parseFSEntry(entry, opts);
        let filename: string;
        let parentFilename: string;
        if (parentIndex === -1) {
            parentFilename = '';
            filename = path.resolve(curDir, relname);
        } else {
            [parentFilename] = parsed[parentIndex];
            filename = path.join(parentFilename, relname);
        }
        parsed.push([filename, parentFilename, kind]);
    });

    return parsed;
}

/**
 * Mirror the directory tree (represented by the given text) on dist.
 */
export async function ensureFSTree(
    spec: string,
    // Use process.cwd() by default.
    cwd?: string
): Promise<string[]> {
    const roots: string[] = [];
    const promises = parseFSTree(spec, cwd)
        // Now ensure each entry exists.
        .map(async (data) => {
            const [filename, parentFilename, kind] = data;

            try {
                if (kind === 'dir') {
                    await fsapi.ensureDir(filename);
                } else if (kind === 'exe') {
                    // "touch" the file.
                    await fsapi.ensureFile(filename);
                    await fsapi.chmod(filename, 0o755);
                } else if (kind === 'file') {
                    // "touch" the file.
                    await fsapi.ensureFile(filename);
                } else {
                    throw Error(`unsupported file kind ${kind}`);
                }
            } catch (err) {
                // tslint:disable-next-line:no-console
                console.log('FAILED:', err);
                throw err;
            }

            if (parentFilename === '') {
                roots.push(filename);
            }
        });
    await Promise.all(promises);
    return roots;
}
