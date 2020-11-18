// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fsapi from 'fs-extra';
import * as path from 'path';
import * as tmp from 'tmp';
import { parseTree } from '../../client/common/utils/text';

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

/**
 * Extract the name and kind for the given entry from a text FS tree.
 *
 * As with `parseFSTree()`, the expected path separator is forward slash
 * (`/`) regardless of the OS.  This allows for consistent usage.
 *
 * If an entry has a trailing slash then it is a directory.  Otherwise
 * it is a file.  Angle brackets(`<>`) around an entry indicate it is
 * an executable file.  (Directories cannot be marked as executable.)
 *
 * Only directory entries can have slashes, both at the end and anywhere
 * else.  However, only root entries (`opts.topLevel === true`) can have
 * a leading slash.
 *
 * @returns - the entry's name (without markers) and kind
 *
 * Examples (valid):
 *
 *   `/x/a_root/`       `['/x/a_root', 'dir']`       # if "topLevel"
 *   `./x/y/z/a_root/`  `['./x/y/z/a_root', 'dir']`  # if "topLevel"
 *   `some_dir/`        `['some_dir`, 'dir']`
 *   `spam`             `['spam', 'file']`
 *   `x/y/z/spam`       `['x/y/z/spam', 'file']`
 *   `<spam>`           `['spam', 'exe']`
 *   `<x/y/z/spam>`     `['x/y/z/spam', 'exe']`
 *   `<spam.exe>        `['spam.exe', 'exe']`
 *
 * Examples (valid but unlikely usage):
 *
 *   `x/y/z/some_dir/`  `['x/y/z/some_dir', 'dir']`  # inline parents
 *
 * Examples (invalid):
 *
 *   `/x/y/z/a_root/`   # if not "topLevel"
 *   `./x/a_root/`  `   # if not "topLevel"
 *   `../a_root/`       # moving above CWD
 *   `x/y/../z/`        # unnormalized
 *   `x/y/./z/`         # unnormalized
 *   `<some_dir/>`      # directories cannot be marked as executable
 *   `<some_dir>/`      # directories cannot be marked as executable
 *   `<spam`            # missing closing bracket
 *   `spam>`            # missing opening bracket
 */
function parseFSEntry(
    entry: string,
    opts: {
        topLevel?: boolean;
        allowInlineParents?: boolean;
    } = {}
): [string, FileKind] {
    let text = entry;
    if (text.startsWith('|')) {
        text = text.slice(1);
    } else {
        // Deal with executables.
        if (text.match(/^<[^/<>]+>$/)) {
            const name = text.slice(1, -1);
            return [name, 'exe'];
        } else if (text.includes('<') || text.includes('>')) {
            throw Error(`bad entry "${entry}"`);
        }
    }

    // Make sure the entry is normalized.
    const candidate = text.startsWith('./') ? text.slice(1) : text;
    if (path.posix.normalize(candidate) !== candidate || text.startsWith('../')) {
        throw Error(`expected normalized path, got "${entry}"`);
    }

    // Handle "top-level" entries.
    if (opts.topLevel) {
        if (!text.endsWith('/')) {
            throw Error(`expected directory at top level, got "${entry}"`);
        }
        if (!text.startsWith('/') && !text.startsWith('./')) {
            throw Error(`expected prefix for top level, got "${entry}"`);
        }
        return [text, 'dir'];
    }

    // Handle other entries.
    let relname: string;
    let kind: FileKind;
    if (text.endsWith('/')) {
        kind = 'dir';
        relname = text.slice(0, -1);
    } else {
        kind = 'file';
        relname = text;
    }
    if (relname.includes('/') && !opts.allowInlineParents) {
        throw Error(`did not expect inline parents, got "${entry}"`);
    }
    if (relname.startsWith('/') || relname.startsWith('./')) {
        throw Error(`expected relative path, got "${entry}"`);
    }
    return [relname, kind];
}

/**
 * Extract the directory tree represented by the given text.'
 *
 * "/" is the expected path separator, regardless of current OS.
 * Directories always end with "/".  Executables are surrounded
 * by angle brackets "<>".  See `parseFSEntry()` for more info.
 *
 * @returns - the flat list of (filename, parentdir, kind) for each
 *            node in the tree
 *
 * Example:
 *
 *   parseFSTree(`
 *       ./x/y/z/root1/
 *           dir1/
 *              file1
 *              subdir1_1/
 *                 # empty
 *              subdir1_2/
 *                  file2
 *                  <file3>
 *              <file4>
 *              file5
 *          dir2/
 *              file6
 *              <file7>
 *       ./x/y/z/root2/
 *           dir3/
 *               subdir3_1/
 *                   file8
 *       ./a/b/root3/
 *           <file9>
 *   `.trim())
 *
 * would produce the following:
 *
 *   [
 *      ['CWD/x/y/z/root1', '', 'dir'],
 *      ['CWD/x/y/z/root1/dir1', 'CWD/x/y/z/root1', 'dir'],
 *      ['CWD/x/y/z/root1/dir1/file1', 'CWD/x/y/z/root1/dir1', 'file'],
 *      ['CWD/x/y/z/root1/dir1/subdir1_1', 'CWD/x/y/z/root1/dir1', 'dir'],
 *      ['CWD/x/y/z/root1/dir1/subdir1_2', 'CWD/x/y/z/root1/dir1', 'dir'],
 *      ['CWD/x/y/z/root1/dir1/subdir1_2/file2', 'CWD/x/y/z/root1/dir1/subdir1_2', 'file'],
 *      ['CWD/x/y/z/root1/dir1/subdir1_2/file3', 'CWD/x/y/z/root1/dir1/subdir1_2', 'exe'],
 *      ['CWD/x/y/z/root1/dir1/file4', 'CWD/x/y/z/root1/dir1', 'exe'],
 *      ['CWD/x/y/z/root1/dir1/file5', 'CWD/x/y/z/root1/dir1', 'file'],
 *      ['CWD/x/y/z/root1/dir2', 'CWD/x/y/z/root1', 'dir'],
 *      ['CWD/x/y/z/root1/dir2/file6', 'CWD/x/y/z/root1/dir2', 'file'],
 *      ['CWD/x/y/z/root1/dir2/file7', 'CWD/x/y/z/root1/dir2', 'exe'],
 *
 *      ['CWD/x/y/z/root2', '', 'dir'],
 *      ['CWD/x/y/z/root2/dir3', 'CWD/x/y/z/root2', 'dir'],
 *      ['CWD/x/y/z/root2/dir3/subdir3_1', 'CWD/x/y/z/root2/dir3', 'dir'],
 *      ['CWD/x/y/z/root2/dir3/subdir3_1/file8', 'CWD/x/y/z/root2/dir3/subdir3_1', 'file'],
 *
 *      ['CWD/a/b/root3', '', 'dir'],
 *      ['CWD/a/b/root3/file9', 'CWD/a/b/root3', 'exe'],
 *   ]
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
        const opts = {
            topLevel: parentIndex === -1,
            allowInlineParents: false
        };
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
 * Mirror the directory tree (represented by the given text) on disk.
 *
 * See `parseFSTree()` for the "spec" format.
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
