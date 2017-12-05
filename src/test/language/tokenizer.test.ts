// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import { TextRangeCollection } from '../../client/language/textRangeCollection';
import { Tokenizer } from '../../client/language/tokenizer';
import { TextRange, TokenType } from '../../client/language/types';

// tslint:disable-next-line:max-func-body-length
suite('Language.Tokenizer', () => {
    test('Empty', async () => {
        const t = new Tokenizer();
        const tokens = t.Tokenize('');
        assert.equal(tokens instanceof TextRangeCollection, true);
        assert.equal(tokens.count, 0);
        assert.equal(tokens.length, 0);
    });
    test('Strings', async () => {
        const t = new Tokenizer();
        const tokens = t.Tokenize(' "string" """line1\n#line2"""\t\'un#closed');
        assert.equal(tokens.count, 3);

        const ranges = [1, 8, 10, 18, 29, 10];
        for (let i = 0; i < tokens.count; i += 1) {
            assert.equal(tokens.getItemAt(i).start, ranges[2 * i]);
            assert.equal(tokens.getItemAt(i).length, ranges[2 * i + 1]);
            assert.equal(tokens.getItemAt(i).type, TokenType.String);
        }
    });
    test('Comments', async () => {
        const t = new Tokenizer();
        const tokens = t.Tokenize(' #co"""mment1\n\t\n#comm\'ent2 ');
        assert.equal(tokens.count, 2);

        const ranges = [1, 12, 15, 11];
        for (let i = 0; i < ranges.length / 2; i += 2) {
            assert.equal(tokens.getItemAt(i).start, ranges[i]);
            assert.equal(tokens.getItemAt(i).length, ranges[i + 1]);
            assert.equal(tokens.getItemAt(i).type, TokenType.Comment);
        }
    });
});
