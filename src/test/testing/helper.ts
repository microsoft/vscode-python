// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { sep } from 'path';
import { Uri } from 'vscode';
import { IS_WINDOWS } from '../../client/common/platform/constants';
import { Tests } from '../../client/testing/common/types';

export const RESOURCE = Uri.file(__filename);

export function lookForTestFile(tests: Tests, testFile: string) {
    let found: boolean;
    // Perform case insensitive search on windows.
    if (IS_WINDOWS) {
        // In the mock output, we'd have paths separated using '/' (but on windows, path separators are '\')
        const testFileToSearch = testFile.split(sep).join('/');
        found = tests.testFiles.some(
            (t) =>
                (t.name.toUpperCase() === testFile.toUpperCase() ||
                    t.name.toUpperCase() === testFileToSearch.toUpperCase()) &&
                t.nameToRun.toUpperCase() === t.name.toUpperCase(),
        );
    } else {
        found = tests.testFiles.some((t) => t.name === testFile && t.nameToRun === t.name);
    }
    assert.equal(found, true, `Test File not found '${testFile}'`);
}

// Return a filename that uses the OS-specific path separator.
//
// Only "/" (forward slash) in the given filename is affected.
//
// This helps with readability in test code.  It allows us to use
// literals for filenames and dirnames instead of path.join().
export function fixPath(filename: string): string {
    return filename.replace(/\//, sep);
}

// Return the indentation part of the given line.
export function getIndent(line: string): string {
    const found = line.match(/^ */);
    return found![0];
}

// Return the dedented lines in the given text.
//
// This is used to represent text concisely and readably, which is
// particularly useful for declarative definitions (e.g. in tests).
//
// (inspired by Python's textwrap.dedent())
export function getDedentedLines(text: string): string[] {
    const linesep = text.includes('\r') ? '\r\n' : '\n';
    const lines = text.split(linesep);
    if (!lines) {
        return [text];
    }

    if (lines[0] !== '') {
        throw Error('expected actual first line to be blank');
    }
    lines.shift();

    if (lines[0] === '') {
        throw Error('expected "first" line to not be blank');
    }
    const leading = getIndent(lines[0]).length;

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (getIndent(line).length < leading) {
            throw Error(`line ${i} has less indent than the "first" line`);
        }
        lines[i] = line.substring(leading);
    }

    return lines;
}
