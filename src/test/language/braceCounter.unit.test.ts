// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import { BraceCounter } from '../../client/language/braceCounter';
import { Tokenizer } from '../../client/language/tokenizer';

suite('Language.BraceCounter', () => {
    test('Brace counting: zero braces', () => {
        const counter = new BraceCounter();

        assert.equal(counter.count, 0);
    });

    ['(x)', '[x]', '{x}'].forEach((text) => {
        test(`Brace counting: ${text}`, () => {
            const counter = new BraceCounter();
            const tokens = new Tokenizer().tokenize(text);

            assert.equal(tokens.count, 3);

            const openBrace = tokens.getItemAt(0);
            const identifier = tokens.getItemAt(1);
            const closeBrace = tokens.getItemAt(2);

            assert.ok(counter.countBrace(tokens.getItemAt(0)));
            assert.equal(counter.countBrace(tokens.getItemAt(1)), false);

            assert.equal(counter.isOpened(openBrace.type), true);
            assert.equal(counter.isOpened(identifier.type), false);
            assert.equal(counter.isOpened(closeBrace.type), true);

            assert.ok(counter.countBrace(tokens.getItemAt(2)));
        });
    });

    ['(x))', '[x]]', '{x}}'].forEach((text) => {
        test(`Brace counting with additional close brace: ${text}`, () => {
            const counter = new BraceCounter();
            const tokens = new Tokenizer().tokenize(text);

            assert.equal(tokens.count, 4);
            for (let i = 0; i < tokens.count - 1; i += 1) {
                counter.countBrace(tokens.getItemAt(i));
            }
            assert.ok(counter.countBrace(tokens.getItemAt(3)));
        });
    });
});
