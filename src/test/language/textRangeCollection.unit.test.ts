// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import { TextRangeCollection } from '../../client/language/textRangeCollection';
import { TextRange } from '../../client/language/types';

suite('Language.TextRangeCollection', () => {
    test('Empty', async () => {
        const items: TextRange[] = [];
        const c = new TextRangeCollection(items);
        assert.strictEqual(c.start, 0);
        assert.strictEqual(c.end, 0);
        assert.strictEqual(c.length, 0);
        assert.strictEqual(c.count, 0);
    });
    test('Basic', async () => {
        const items: TextRange[] = [];
        items.push(new TextRange(2, 1));
        items.push(new TextRange(4, 2));
        const c = new TextRangeCollection(items);
        assert.strictEqual(c.start, 2);
        assert.strictEqual(c.end, 6);
        assert.strictEqual(c.length, 4);
        assert.strictEqual(c.count, 2);

        assert.strictEqual(c.getItemAt(0).start, 2);
        assert.strictEqual(c.getItemAt(0).length, 1);

        assert.strictEqual(c.getItemAt(1).start, 4);
        assert.strictEqual(c.getItemAt(1).length, 2);
    });
    test('Contains position (simple)', async () => {
        const items: TextRange[] = [];
        items.push(new TextRange(2, 1));
        items.push(new TextRange(4, 2));
        const c = new TextRangeCollection(items);
        const results = [-1, -1, 0, -1, 1, 1, -1];
        for (let i = 0; i < results.length; i += 1) {
            const index = c.getItemContaining(i);
            assert.strictEqual(index, results[i]);
        }
    });
    test('Contains position (adjoint)', async () => {
        const items: TextRange[] = [];
        items.push(new TextRange(2, 1));
        items.push(new TextRange(3, 2));
        const c = new TextRangeCollection(items);
        const results = [-1, -1, 0, 1, 1, -1, -1];
        for (let i = 0; i < results.length; i += 1) {
            const index = c.getItemContaining(i);
            assert.strictEqual(index, results[i]);
        }
    });
    test('Contains position (out of range)', async () => {
        const items: TextRange[] = [];
        items.push(new TextRange(2, 1));
        items.push(new TextRange(4, 2));
        const c = new TextRangeCollection(items);
        const positions = [-100, -1, 10, 100];
        for (const p of positions) {
            const index = c.getItemContaining(p);
            assert.strictEqual(index, -1);
        }
    });
    test('Contains position (empty)', async () => {
        const items: TextRange[] = [];
        const c = new TextRangeCollection(items);
        const positions = [-2, -1, 0, 1, 2, 3];
        for (const p of positions) {
            const index = c.getItemContaining(p);
            assert.strictEqual(index, -1);
        }
    });
    test('Item at position', async () => {
        const items: TextRange[] = [];
        items.push(new TextRange(2, 1));
        items.push(new TextRange(4, 2));
        const c = new TextRangeCollection(items);
        const results = [-1, -1, 0, -1, 1, -1, -1];
        for (let i = 0; i < results.length; i += 1) {
            const index = c.getItemAtPosition(i);
            assert.strictEqual(index, results[i]);
        }
    });
});
