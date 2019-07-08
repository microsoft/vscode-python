// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';

import {
    DECREASE_INDENT_REGEX,
    INCREASE_INDENT_REGEX,
    MULTILINE_SEPARATOR_INDENT_REGEX
} from '../../client/language/languageConfiguration';

suite('Language configuration regexes', () => {
    test('Multiline separator indent regex should not pick up strings with no multiline separator', async () => {
        const result = MULTILINE_SEPARATOR_INDENT_REGEX.test('a = "test"');
        expect (result).to.be.equal(false, 'Multiline separator indent regex for regular strings should not have matches');
    });

    test('Multiline separator indent regex should not pick up strings with escaped characters', async () => {
        const result = MULTILINE_SEPARATOR_INDENT_REGEX.test('a = \'hello \\n\'');
        expect (result).to.be.equal(false, 'Multiline separator indent regex for strings with escaped characters should not have matches');
    });

    test('Multiline separator indent regex should pick up strings ending with a multiline separator', async () => {
        const result = MULTILINE_SEPARATOR_INDENT_REGEX.test('a = \'multiline \\');
        expect (result).to.be.equal(true, 'Multiline separator indent regex for strings with newline separator should have matches');
    });

    [
        {
            keyword: 'def',
            line: 'def foo:',
            dedent: false
        },
        {
            keyword: 'class',
            line: 'class TestClass:',
            dedent: false
        },
        {
            keyword: 'for',
            line: 'for item in items:',
            dedent: false
        },
        {
            keyword: 'if',
            line: 'if foo is None:',
            dedent: false
        },
        {
            keyword: 'elif',
            line: 'elif x < 5:',
            dedent: true
        },
        {
            keyword: 'else',
            line: 'else:',
            dedent: true
        },
        {
            keyword: 'while',
            line: 'while \'::\' in macaddress:',
            dedent: false
        },
        {
            keyword: 'try',
            line: 'try:',
            dedent: false
        },
        {
            keyword: 'with',
            line: 'with self.test:',
            dedent: false
        },
        {
            keyword: 'finally',
            line: 'finally:',
            dedent: false
        },
        {
            keyword: 'except',
            line: 'except TestError:',
            dedent: false
        },
        {
            keyword: 'async',
            line: 'async def test(self):',
            dedent: false
        }
    ].forEach(({ keyword, line, dedent }) => {
        test(`Increase indent regex should pick up lines containing the ${keyword} keyword`, async () => {
            const result = INCREASE_INDENT_REGEX.test(line);
            expect(result).to.be.equal(true, `Increase indent regex should pick up lines containing the ${keyword} keyword`);
        });

        test(`Decrease indent regex should ${dedent ? '' : 'not '}pick up lines containing the ${keyword} keyword`, async () => {
            const result = DECREASE_INDENT_REGEX.test(line);
            expect(result).to.be.equal(dedent, `Decrease indent regex should ${dedent ? '' : 'not '}pick up lines containing the ${keyword} keyword`);
        });
    });

    test('Increase indent regex should not pick up lines without keywords', async () => {
        const result = INCREASE_INDENT_REGEX.test('a = \'hello \\n \'');
        expect(result).to.be.equal(false, 'Increase indent regex should not pick up lines without keywords');
    });

    test('Decrease indent regex should not pick up lines without keywords', async () => {
        const result = DECREASE_INDENT_REGEX.test('a = \'hello \\n \'');
        expect(result).to.be.equal(false, 'Decrease indent regex should not pick up lines without keywords');
    });
});
