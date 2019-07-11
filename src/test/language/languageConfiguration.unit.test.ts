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
        'async def test(self):',
        'class TestClass:',
        'def foo(self, node, namespace=""):',
        'for item in items:',
        'if foo is None:',
        'try:',
        'while \'::\' in macaddress:',
        'with self.test:'
    ].forEach(example => {
        const keyword = example.split(' ')[0];

        test(`Increase indent regex should pick up lines containing the ${keyword} keyword`, async () => {
            const result = INCREASE_INDENT_REGEX.test(example);
            expect(result).to.be.equal(true, `Increase indent regex should pick up lines containing the ${keyword} keyword`);
        });

        test(`Decrease indent regex should not pick up lines containing the ${keyword} keyword`, async () => {
            const result = DECREASE_INDENT_REGEX.test(example);
            expect(result).to.be.equal(false, `Decrease indent regex should not pick up lines containing the ${keyword} keyword`);
        });
    });

    ['elif x < 5:', 'else:', 'except TestError:', 'finally:'].forEach(example => {
        const keyword = example.split(' ')[0];

        test(`Increase indent regex should pick up lines containing the ${keyword} keyword`, async () => {
            const result = INCREASE_INDENT_REGEX.test(example);
            expect(result).to.be.equal(true, `Increase indent regex should pick up lines containing the ${keyword} keyword`);
        });

        test(`Decrease indent regex should pick up lines containing the ${keyword} keyword`, async () => {
            const result = DECREASE_INDENT_REGEX.test(example);
            expect(result).to.be.equal(true, `Decrease indent regex should pick up lines containing the ${keyword} keyword`);
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
            returnValue: 3,
            hasComment: true
        },
        {
            type: 'boolean',
            returnValue: 'True',
            hasComment: false
        },
        {
            type: 'string',
            returnValue: '\'test\'',
            hasComment: false
        },
        {
            type: 'variable name',
            returnValue: 'hello',
            hasComment: true
        },
        {
            type: 'closed array',
            returnValue: '[ 1, 2, 3 ]',
            hasComment: true
        },
        {
            type: 'closed dictionary',
            returnValue: '{ "id": 23, "enabled": True }',
            hasComment: true
        },
        {
            type: 'closed tuple',
            returnValue: '( "test", 23, False )',
            hasComment: false
        }
    ].forEach(({ type, returnValue, hasComment }) => {
        const testTitle = `Outdent return regex on enter should pick up lines containing the return statement followed by a ${type}`;
        test(testTitle, () => {
            const result = OUTDENT_RETURN_REGEX.test(`return ${returnValue} ${hasComment ? '# test comment' : ''}`);
            expect(result).to.be.equal(true, testTitle);
        });
    });

    [
        {
            returnValue: '[ 1, 2',
            hasComment: false,
            match: false
        },
        {
            returnValue: '{ ',
            hasComment: false,
            match: false
        },
        {
            returnValue: '( False',
            hasComment: true,
            match: false
        }
    ].forEach(({ returnValue, hasComment }) => {
        const type = returnValue[0];

        const testTitle = `Outdent return regex on enter should not pick up lines containing the return statement followed by a dangling ${type}`;
        test(testTitle, () => {
            const result = OUTDENT_RETURN_REGEX.test(`return ${returnValue} ${hasComment ? '# test comment' : ''}`);
            expect(result).to.be.equal(false, testTitle);
        });
    });
});
