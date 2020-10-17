// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { zip } from 'lodash';
import { PythonEnvInfo } from '../../../../client/pythonEnvironments/base/info';

export function assertEnvEqual(actual:PythonEnvInfo | undefined, expected: PythonEnvInfo | undefined):void {
    assert.notStrictEqual(actual, undefined);
    assert.notStrictEqual(expected, undefined);

    if (actual) {
    // ensure ctime and mtime are greater than -1
        assert.ok(actual?.executable.ctime > -1);
        assert.ok(actual?.executable.mtime > -1);

        // No need to match these, so reset them
        actual.executable.ctime = -1;
        actual.executable.mtime = -1;

        assert.deepStrictEqual(actual, expected);
    }
}

export function assertEnvsEqual(
    actualEnvs:(PythonEnvInfo | undefined)[],
    expectedEnvs: (PythonEnvInfo | undefined)[],
):void{
    zip(actualEnvs, expectedEnvs).forEach((value) => {
        const [actual, expected] = value;
        assertEnvEqual(actual, expected);
    });
}
