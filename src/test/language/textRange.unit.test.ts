// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import { TextRange } from '../../client/language/types';

suite('Language.TextRange', () => {
    test('Empty static', async () => {
        const e = TextRange.empty;
        assert.strictEqual(e.start, 0);
        assert.strictEqual(e.end, 0);
        assert.strictEqual(e.length, 0);
    });
    test('Construction', async () => {
        let r = new TextRange(10, 20);
        assert.strictEqual(r.start, 10);
        assert.strictEqual(r.end, 30);
        assert.strictEqual(r.length, 20);
        r = new TextRange(10, 0);
        assert.strictEqual(r.start, 10);
        assert.strictEqual(r.end, 10);
        assert.strictEqual(r.length, 0);
    });
    test('From bounds', async () => {
        let r = TextRange.fromBounds(7, 9);
        assert.strictEqual(r.start, 7);
        assert.strictEqual(r.end, 9);
        assert.strictEqual(r.length, 2);

        r = TextRange.fromBounds(5, 5);
        assert.strictEqual(r.start, 5);
        assert.strictEqual(r.end, 5);
        assert.strictEqual(r.length, 0);
    });
    test('Contains', async () => {
        const r = TextRange.fromBounds(7, 9);
        assert.strictEqual(r.contains(-1), false);
        assert.strictEqual(r.contains(6), false);
        assert.strictEqual(r.contains(7), true);
        assert.strictEqual(r.contains(8), true);
        assert.strictEqual(r.contains(9), false);
        assert.strictEqual(r.contains(10), false);
    });
    test('Exceptions', async () => {
        assert.throws(() => {
            // @ts-ignore
            const e = new TextRange(0, -1);
        }, Error);
        assert.throws(() => {
            // @ts-ignore
            const e = TextRange.fromBounds(3, 1);
        }, Error);
    });
});
