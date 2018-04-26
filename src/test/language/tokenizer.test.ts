// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import { TextRangeCollection } from '../../client/language/textRangeCollection';
import { Tokenizer } from '../../client/language/tokenizer';
import { TokenType } from '../../client/language/types';

// tslint:disable-next-line:max-func-body-length
suite('Language.Tokenizer', () => {
    test('Empty', () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('');
        assert.equal(tokens instanceof TextRangeCollection, true);
        assert.equal(tokens.count, 0);
        assert.equal(tokens.length, 0);
    });
    test('Strings: unclosed', () => {
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
    test('Strings: block next to regular, double-quoted', () => {
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
    test('Strings: block next to block, double-quoted', () => {
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
    test('Strings: unclosed sequence of quotes', () => {
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
    test('Strings: single quote escape', () => {
        const t = new Tokenizer();
        // tslint:disable-next-line:quotemark
        const tokens = t.tokenize("'\\'quoted\\''");
        assert.equal(tokens.count, 1);
        assert.equal(tokens.getItemAt(0).type, TokenType.String);
        assert.equal(tokens.getItemAt(0).length, 12);
    });
    test('Strings: double quote escape', () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('"\\"quoted\\""');
        assert.equal(tokens.count, 1);
        assert.equal(tokens.getItemAt(0).type, TokenType.String);
        assert.equal(tokens.getItemAt(0).length, 12);
    });
    test('Strings: single quoted f-string ', () => {
        const t = new Tokenizer();
        // tslint:disable-next-line:quotemark
        const tokens = t.tokenize("a+f'quoted'");
        assert.equal(tokens.count, 3);
        assert.equal(tokens.getItemAt(0).type, TokenType.Identifier);
        assert.equal(tokens.getItemAt(1).type, TokenType.Operator);
        assert.equal(tokens.getItemAt(2).type, TokenType.String);
        assert.equal(tokens.getItemAt(2).length, 9);
    });
    test('Strings: double quoted f-string ', () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('x(1,f"quoted")');
        assert.equal(tokens.count, 6);
        assert.equal(tokens.getItemAt(0).type, TokenType.Identifier);
        assert.equal(tokens.getItemAt(1).type, TokenType.OpenBrace);
        assert.equal(tokens.getItemAt(2).type, TokenType.Number);
        assert.equal(tokens.getItemAt(3).type, TokenType.Comma);
        assert.equal(tokens.getItemAt(4).type, TokenType.String);
        assert.equal(tokens.getItemAt(4).length, 9);
        assert.equal(tokens.getItemAt(5).type, TokenType.CloseBrace);
    });
    test('Strings: single quoted multiline f-string ', () => {
        const t = new Tokenizer();
        // tslint:disable-next-line:quotemark
        const tokens = t.tokenize("f'''quoted'''");
        assert.equal(tokens.count, 1);
        assert.equal(tokens.getItemAt(0).type, TokenType.String);
        assert.equal(tokens.getItemAt(0).length, 13);
    });
    test('Strings: double quoted multiline f-string ', () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('f"""quoted """');
        assert.equal(tokens.count, 1);
        assert.equal(tokens.getItemAt(0).type, TokenType.String);
        assert.equal(tokens.getItemAt(0).length, 14);
    });
    test('Strings: escape at the end of single quoted string ', () => {
        const t = new Tokenizer();
        // tslint:disable-next-line:quotemark
        const tokens = t.tokenize("'quoted\\'\nx");
        assert.equal(tokens.count, 2);
        assert.equal(tokens.getItemAt(0).type, TokenType.String);
        assert.equal(tokens.getItemAt(0).length, 9);
        assert.equal(tokens.getItemAt(1).type, TokenType.Identifier);
    });
    test('Strings: escape at the end of double quoted string ', () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('"quoted\\"\nx');
        assert.equal(tokens.count, 2);
        assert.equal(tokens.getItemAt(0).type, TokenType.String);
        assert.equal(tokens.getItemAt(0).length, 9);
        assert.equal(tokens.getItemAt(1).type, TokenType.Identifier);
    });
    test('Strings: b/u/r-string', () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('b"b" u"u" br"br" ur"ur"');
        assert.equal(tokens.count, 4);
        assert.equal(tokens.getItemAt(0).type, TokenType.String);
        assert.equal(tokens.getItemAt(0).length, 4);
        assert.equal(tokens.getItemAt(1).type, TokenType.String);
        assert.equal(tokens.getItemAt(1).length, 4);
        assert.equal(tokens.getItemAt(2).type, TokenType.String);
        assert.equal(tokens.getItemAt(2).length, 6);
        assert.equal(tokens.getItemAt(3).type, TokenType.String);
        assert.equal(tokens.getItemAt(3).length, 6);
    });
    test('Strings: escape at the end of double quoted string ', () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('"quoted\\"\nx');
        assert.equal(tokens.count, 2);
        assert.equal(tokens.getItemAt(0).type, TokenType.String);
        assert.equal(tokens.getItemAt(0).length, 9);
        assert.equal(tokens.getItemAt(1).type, TokenType.Identifier);
    });
    test('Comments', () => {
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
    test('Period to operator token', () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('x.y');
        assert.equal(tokens.count, 3);

        assert.equal(tokens.getItemAt(0).type, TokenType.Identifier);
        assert.equal(tokens.getItemAt(1).type, TokenType.Operator);
        assert.equal(tokens.getItemAt(2).type, TokenType.Identifier);
    });
    test('@ to operator token', () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('@x');
        assert.equal(tokens.count, 2);

        assert.equal(tokens.getItemAt(0).type, TokenType.Operator);
        assert.equal(tokens.getItemAt(1).type, TokenType.Identifier);
    });
    test('Unknown token', () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('~$');
        assert.equal(tokens.count, 1);

        assert.equal(tokens.getItemAt(0).type, TokenType.Unknown);
    });
    test('Hex number', () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('1 0X2 0x3 0x');
        assert.equal(tokens.count, 4);

        assert.equal(tokens.getItemAt(0).type, TokenType.Number);
        assert.equal(tokens.getItemAt(0).length, 1);

        assert.equal(tokens.getItemAt(1).type, TokenType.Number);
        assert.equal(tokens.getItemAt(1).length, 3);

        assert.equal(tokens.getItemAt(2).type, TokenType.Number);
        assert.equal(tokens.getItemAt(2).length, 3);

        assert.equal(tokens.getItemAt(3).type, TokenType.Unknown);
        assert.equal(tokens.getItemAt(3).length, 2);
    });
    test('Binary number', () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('1 0B1 0b010 0b3 0b');
        assert.equal(tokens.count, 6);

        assert.equal(tokens.getItemAt(0).type, TokenType.Number);
        assert.equal(tokens.getItemAt(0).length, 1);

        assert.equal(tokens.getItemAt(1).type, TokenType.Number);
        assert.equal(tokens.getItemAt(1).length, 3);

        assert.equal(tokens.getItemAt(2).type, TokenType.Number);
        assert.equal(tokens.getItemAt(2).length, 5);

        assert.equal(tokens.getItemAt(3).type, TokenType.Number);
        assert.equal(tokens.getItemAt(3).length, 1);

        assert.equal(tokens.getItemAt(4).type, TokenType.Identifier);
        assert.equal(tokens.getItemAt(4).length, 2);

        assert.equal(tokens.getItemAt(5).type, TokenType.Unknown);
        assert.equal(tokens.getItemAt(5).length, 2);
    });
    test('Octal number', () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('1 0o4 0o077 -0o200 0o9 0oO');
        assert.equal(tokens.count, 7);

        assert.equal(tokens.getItemAt(0).type, TokenType.Number);
        assert.equal(tokens.getItemAt(0).length, 1);

        assert.equal(tokens.getItemAt(1).type, TokenType.Number);
        assert.equal(tokens.getItemAt(1).length, 3);

        assert.equal(tokens.getItemAt(2).type, TokenType.Number);
        assert.equal(tokens.getItemAt(2).length, 5);

        assert.equal(tokens.getItemAt(3).type, TokenType.Number);
        assert.equal(tokens.getItemAt(3).length, 6);

        assert.equal(tokens.getItemAt(4).type, TokenType.Number);
        assert.equal(tokens.getItemAt(4).length, 1);

        assert.equal(tokens.getItemAt(5).type, TokenType.Identifier);
        assert.equal(tokens.getItemAt(5).length, 2);

        assert.equal(tokens.getItemAt(6).type, TokenType.Unknown);
        assert.equal(tokens.getItemAt(6).length, 3);
    });
    test('Decimal number', () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('-2147483647 ++2147483647');
        assert.equal(tokens.count, 3);

        assert.equal(tokens.getItemAt(0).type, TokenType.Number);
        assert.equal(tokens.getItemAt(0).length, 11);

        assert.equal(tokens.getItemAt(1).type, TokenType.Operator);
        assert.equal(tokens.getItemAt(1).length, 1);

        assert.equal(tokens.getItemAt(2).type, TokenType.Number);
        assert.equal(tokens.getItemAt(2).length, 11);
    });
    test('Decimal number operator', () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('a[: -1]');
        assert.equal(tokens.count, 5);

        assert.equal(tokens.getItemAt(3).type, TokenType.Number);
        assert.equal(tokens.getItemAt(3).length, 2);
    });
    test('Floating point number', () => {
        const t = new Tokenizer();
        const tokens = t.tokenize('3.0 .2 ++.3e+12 --.4e1');
        assert.equal(tokens.count, 6);

        assert.equal(tokens.getItemAt(0).type, TokenType.Number);
        assert.equal(tokens.getItemAt(0).length, 3);

        assert.equal(tokens.getItemAt(1).type, TokenType.Number);
        assert.equal(tokens.getItemAt(1).length, 2);

        assert.equal(tokens.getItemAt(2).type, TokenType.Operator);
        assert.equal(tokens.getItemAt(2).length, 1);

        assert.equal(tokens.getItemAt(3).type, TokenType.Number);
        assert.equal(tokens.getItemAt(3).length, 7);

        assert.equal(tokens.getItemAt(4).type, TokenType.Operator);
        assert.equal(tokens.getItemAt(4).length, 1);

        assert.equal(tokens.getItemAt(5).type, TokenType.Number);
        assert.equal(tokens.getItemAt(5).length, 5);
    });
    test('Operators', () => {
        const text = '< <> << <<= ' +
            '== != > >> >>= >= <=' +
            '+ -' +
            '* ** / /= //=' +
            '*= += -= **= ' +
            '& &= | |= ^ ^= ->';
        const tokens = new Tokenizer().tokenize(text);
        const lengths = [
            1, 2, 2, 3,
            2, 2, 1, 2, 3, 2, 2,
            1, 1,
            1, 2, 1, 2, 3,
            2, 2, 2, 3,
            1, 2, 1, 2, 1, 2, 2];
        assert.equal(tokens.count, lengths.length);
        for (let i = 0; i < tokens.count; i += 1) {
            const t = tokens.getItemAt(i);
            assert.equal(t.type, TokenType.Operator, `${t.type} at ${i} is not an operator`);
            assert.equal(t.length, lengths[i], `Length ${t.length} at ${i} (text ${text.substr(t.start, t.length)}), expected ${lengths[i]}`);
        }
    });
});
