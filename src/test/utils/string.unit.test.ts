// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any no-require-imports no-var-requires

import { expect } from 'chai';
import { splitParent } from '../../utils/string';

suite('splitParent()', () => {
    test('valid values', async () => {
        const tests: [string, [string, string]][] = [
            ['x.y', ['x', 'y']],
            ['x', ['', 'x']],
            ['x.y.z', ['x.y', 'z']],
            ['', ['', '']]
        ];
        for (const [raw, expected] of tests) {
            const result = splitParent(raw);

            expect(result).to.deep.equal(expected);
        }
    });
});
