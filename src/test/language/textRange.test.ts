// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import { TextRange } from '../../client/language/types';

// tslint:disable-next-line:max-func-body-length
suite('Language.TextRange', () => {
    test('Empty static', async () => {
        const e = TextRange.empty;
        assert.equal(e.start, 0);
        assert.equal(e.end, 0);
        assert.equal(e.length, 0);
    });
    test('Construction', async () => {
        let r = new TextRange(10, 20);
        assert.equal(r.start, 10);
        assert.equal(r.end, 30);
        assert.equal(r.length, 20);
        r = new TextRange(10, 0);
        assert.equal(r.start, 10);
        assert.equal(r.end, 10);
        assert.equal(r.length, 0);
    });
    test('From bounds', async () => {
        let r = TextRange.fromBounds(7, 9);
        assert.equal(r.start, 7);
        assert.equal(r.end, 9);
        assert.equal(r.length, 2);

        r = TextRange.fromBounds(5, 5);
        assert.equal(r.start, 5);
        assert.equal(r.end, 5);
        assert.equal(r.length, 0);
    });
    test('Contains', async () => {
        const r = TextRange.fromBounds(7, 9);
        assert.equal(r.contains(-1), false);
        assert.equal(r.contains(6), false);
        assert.equal(r.contains(7), true);
        assert.equal(r.contains(8), true);
        assert.equal(r.contains(9), false);
        assert.equal(r.contains(10), false);
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
