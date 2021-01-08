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
