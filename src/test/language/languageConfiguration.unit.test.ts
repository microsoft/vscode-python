// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';

import {
    DECREASE_INDENT_REGEX,
    INCREASE_INDENT_REGEX,
    MULTILINE_SEPARATOR_INDENT_REGEX,
    OUTDENT_RETURN_REGEX,
    OUTDENT_SINGLE_KEYWORD_REGEX
} from '../../client/language/languageConfiguration';

// tslint:disable-next-line: max-func-body-length
suite('Language configuration regexes', () => {
    test('Multiline separator indent regex should not pick up strings with no multiline separator', async () => {
        const result = MULTILINE_SEPARATOR_INDENT_REGEX.test('a = "test"');
        expect(result).to.be.equal(false, 'Multiline separator indent regex for regular strings should not have matches');
    });

    test('Multiline separator indent regex should not pick up strings with escaped characters', async () => {
        const result = MULTILINE_SEPARATOR_INDENT_REGEX.test('a = \'hello \\n\'');
        expect(result).to.be.equal(false, 'Multiline separator indent regex for strings with escaped characters should not have matches');
    });

    test('Multiline separator indent regex should pick up strings ending with a multiline separator', async () => {
        const result = MULTILINE_SEPARATOR_INDENT_REGEX.test('a = \'multiline \\');
        expect(result).to.be.equal(true, 'Multiline separator indent regex for strings with newline separator should have matches');
    });

    [
        {
            keyword: 'async',
            example: 'async def test(self):',
            dedent: false
        },
        {
            keyword: 'class',
            example: 'class TestClass:',
            dedent: false
        },
        {
            keyword: 'def',
            example: 'def foo(self, node, namespace=""):',
            dedent: false
        },
        {
            keyword: 'elif',
            example: 'elif x < 5:',
            dedent: true
        },
        {
            keyword: 'else',
            example: 'else:',
            dedent: true
        },
        {
            keyword: 'except',
            example: 'except TestError:',
            dedent: true
        },
        {
            keyword: 'finally',
            example: 'finally:',
            dedent: true
        },
        {
            keyword: 'for',
            example: 'for item in items:',
            dedent: false
        },
        {
            keyword: 'if',
            example: 'if foo is None:',
            dedent: false
        },
        {
            keyword: 'try',
            example: 'try:',
            dedent: false
        },
        {
            keyword: 'while',
            example: 'while \'::\' in macaddress:',
            dedent: false
        },
        {
            keyword: 'with',
            example: 'with self.test:',
            dedent: false
        }
    ].forEach(({ keyword, example, dedent }) => {
        test(`Increase indent regex should pick up lines containing the ${keyword} keyword`, async () => {
            const result = INCREASE_INDENT_REGEX.test(example);
            expect(result).to.be.equal(true, `Increase indent regex should pick up lines containing the ${keyword} keyword`);
        });

        test(`Decrease indent regex should ${dedent ? '' : 'not '}pick up lines containing the ${keyword} keyword`, async () => {
            const result = DECREASE_INDENT_REGEX.test(example);
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

    [
        {
            keyword: 'break',
            example: '    break'
        },
        {
            keyword: 'continue',
            example: '\t\t continue'
        },
        {
            keyword: 'pass',
            example: ' pass'
        },
        {
            keyword: 'raise',
            example: 'raise Exception(\'Unknown Exception\''
        }
    ].forEach(({ keyword, example }) => {
        const testWithoutComments = `Outdent regex for on enter rule should pick up lines containing the ${keyword} keyword`;
        test(testWithoutComments, () => {
            const result = OUTDENT_SINGLE_KEYWORD_REGEX.test(example);
            expect(result).to.be.equal(true, testWithoutComments);
        });

        const testWithComments = `Outdent regex on enter should pick up lines containing the ${keyword} keyword and ending with comments`;
        test(testWithComments, () => {
            const result = OUTDENT_SINGLE_KEYWORD_REGEX.test(`${example} # test comment`);
            expect(result).to.be.equal(true, testWithComments);
        });
    });

    [
        {
            type: 'number',
            value: 3,
            hasComment: true,
            match: true
        },
        {
            type: 'boolean',
            value: 'True',
            hasComment: false,
            match: true
        },
        {
            type: 'string',
            value: '\'test\'',
            hasComment: false,
            match: true
        },
        {
            type: 'variable name',
            value: 'hello',
            hasComment: true,
            match: true
        },
        {
            type: 'closed array',
            value: '[ 1, 2, 3 ]',
            hasComment: true,
            match: true
        },
        {
            type: 'closed dictionary',
            value: '{ "id": 23, "enabled": True }',
            hasComment: true,
            match: true
        },
        {
            type: 'closed tuple',
            value: '( "test", 23, False )',
            hasComment: false,
            match: true
        },
        {
            type: 'dangling [',
            value: '[',
            hasComment: false,
            match: false
        },
        {
            type: 'dangling {',
            value: '{',
            hasComment: false,
            match: false
        },
        {
            type: 'dangling (',
            value: '(',
            hasComment: true,
            match: false
        }
    ].forEach(({ type, value, hasComment, match }) => {
        const testTitle = `Outdent return regex on enter should ${match ? '' : 'not '}pick up lines containing the return statement followed by a ${type}`;
        test(testTitle, () => {
            const result = OUTDENT_RETURN_REGEX.test(`return ${value} ${hasComment ? '# test comment' : ''}`);
            expect(result).to.be.equal(match, testTitle);
        });
    });
});
