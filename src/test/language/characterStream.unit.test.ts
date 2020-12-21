// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';

import Char from 'typescript-char';
import { CharacterStream } from '../../client/language/characterStream';
import { TextIterator } from '../../client/language/textIterator';
import { ICharacterStream } from '../../client/language/types';

suite('Language.CharacterStream', () => {
    test('Iteration (string)', async () => {
        const content = 'some text';
        const cs = new CharacterStream(content);
        testIteration(cs, content);
    });
    test('Iteration (iterator)', async () => {
        const content = 'some text';
        const cs = new CharacterStream(new TextIterator(content));
        testIteration(cs, content);
    });
    test('Positioning', async () => {
        const content = 'some text';
        const cs = new CharacterStream(content);
        assert.equal(cs.position, 0);
        cs.advance(1);
        assert.equal(cs.position, 1);
        cs.advance(1);
        assert.equal(cs.position, 2);
        cs.advance(2);
        assert.equal(cs.position, 4);
        cs.advance(-3);
        assert.equal(cs.position, 1);
        cs.advance(-3);
        assert.equal(cs.position, 0);
        cs.advance(100);
        assert.equal(cs.position, content.length);
    });
    test('Characters', async () => {
        const content = 'some \ttext "" \' \' \n text \r\n more text';
        const cs = new CharacterStream(content);
        for (let i = 0; i < content.length; i += 1) {
            assert.equal(cs.currentChar, content.charCodeAt(i));

            assert.equal(cs.nextChar, i < content.length - 1 ? content.charCodeAt(i + 1) : 0);
            assert.equal(cs.prevChar, i > 0 ? content.charCodeAt(i - 1) : 0);

            assert.equal(cs.lookAhead(2), i < content.length - 2 ? content.charCodeAt(i + 2) : 0);
            assert.equal(cs.lookAhead(-2), i > 1 ? content.charCodeAt(i - 2) : 0);

            const ch = content.charCodeAt(i);
            const isLineBreak = ch === Char.LineFeed || ch === Char.CarriageReturn;
            assert.equal(cs.isAtWhiteSpace(), ch === Char.Tab || ch === Char.Space || isLineBreak);
            assert.equal(cs.isAtLineBreak(), isLineBreak);
            assert.equal(cs.isAtString(), ch === Char.SingleQuote || ch === Char.DoubleQuote);

            cs.moveNext();
        }
    });
    test('Skip', async () => {
        const content = 'some \ttext "" \' \' \n text \r\n more text';
        const cs = new CharacterStream(content);

        cs.skipWhitespace();
        assert.equal(cs.position, 0);

        cs.skipToWhitespace();
        assert.equal(cs.position, 4);

        cs.skipToWhitespace();
        assert.equal(cs.position, 4);

        cs.skipWhitespace();
        assert.equal(cs.position, 6);

        cs.skipLineBreak();
        assert.equal(cs.position, 6);

        cs.skipToEol();
        assert.equal(cs.position, 18);

        cs.skipLineBreak();
        assert.equal(cs.position, 19);
    });
});

function testIteration(cs: ICharacterStream, content: string) {
    assert.equal(cs.position, 0);
    assert.equal(cs.length, content.length);
    assert.equal(cs.isEndOfStream(), false);

    for (let i = -2; i < content.length + 2; i += 1) {
        const ch = cs.charCodeAt(i);
        if (i < 0 || i >= content.length) {
            assert.equal(ch, 0);
        } else {
            assert.equal(ch, content.charCodeAt(i));
        }
    }

    for (let i = 0; i < content.length; i += 1) {
        assert.equal(cs.isEndOfStream(), false);
        assert.equal(cs.position, i);
        assert.equal(cs.currentChar, content.charCodeAt(i));
        cs.moveNext();
    }

    assert.equal(cs.isEndOfStream(), true);
    assert.equal(cs.position, content.length);
}
