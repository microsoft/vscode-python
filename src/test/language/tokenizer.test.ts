// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import { TextRangeCollection } from '../../client/language/textRangeCollection';
import { Tokenizer } from '../../client/language/tokenizer';
import { TokenType } from '../../client/language/types';

// tslint:disable-next-line:max-func-body-length
suite('Language.Tokenizer', () => {
    test('Empty', async () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('');
        assert.equal(tokens instanceof TextRangeCollection, true);
        assert.equal(tokens.count, 0);
        assert.equal(tokens.length, 0);
    });
    test('Strings: unclosed', async () => {
        const t = new Tokenizer();
        const tokens = t.tokenize(' "string" """line1\n#line2"""\t\'un#closed');
        assert.equal(tokens.count, 3);

        const ranges = [1, 8, 10, 18, 29, 10];
        for (let i = 0; i < tokens.count; i += 1) {
            assert.equal(tokens.getItemAt(i).start, ranges[2 * i]);
            assert.equal(tokens.getItemAt(i).length, ranges[2 * i + 1]);
            assert.equal(tokens.getItemAt(i).type, TokenType.String);
        }
    });
    test('Strings: block next to regular, double-quoted', async () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('"string""""s2"""');
        assert.equal(tokens.count, 2);

        const ranges = [0, 8, 8, 8];
        for (let i = 0; i < tokens.count; i += 1) {
            assert.equal(tokens.getItemAt(i).start, ranges[2 * i]);
            assert.equal(tokens.getItemAt(i).length, ranges[2 * i + 1]);
            assert.equal(tokens.getItemAt(i).type, TokenType.String);
        }
    });
    test('Strings: block next to block, double-quoted', async () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('""""""""');
        assert.equal(tokens.count, 2);

        const ranges = [0, 6, 6, 2];
        for (let i = 0; i < tokens.count; i += 1) {
            assert.equal(tokens.getItemAt(i).start, ranges[2 * i]);
            assert.equal(tokens.getItemAt(i).length, ranges[2 * i + 1]);
            assert.equal(tokens.getItemAt(i).type, TokenType.String);
        }
    });
    test('Strings: unclosed sequence of quotes', async () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('"""""');
        assert.equal(tokens.count, 1);

        const ranges = [0, 5];
        for (let i = 0; i < tokens.count; i += 1) {
            assert.equal(tokens.getItemAt(i).start, ranges[2 * i]);
            assert.equal(tokens.getItemAt(i).length, ranges[2 * i + 1]);
            assert.equal(tokens.getItemAt(i).type, TokenType.String);
        }
    });
    test('Comments', async () => {
        const t = new Tokenizer();
        const tokens = t.tokenize(' #co"""mment1\n\t\n#comm\'ent2 ');
        assert.equal(tokens.count, 2);

        const ranges = [1, 12, 15, 11];
        for (let i = 0; i < ranges.length / 2; i += 2) {
            assert.equal(tokens.getItemAt(i).start, ranges[i]);
            assert.equal(tokens.getItemAt(i).length, ranges[i + 1]);
            assert.equal(tokens.getItemAt(i).type, TokenType.Comment);
        }
    });
    test('Unknown token', async () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('.');
        assert.equal(tokens.count, 1);

        assert.equal(tokens.getItemAt(0).type, TokenType.Unknown);
    });
});
