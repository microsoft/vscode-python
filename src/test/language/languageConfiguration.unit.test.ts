// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import { expect } from 'chai';

import {
    getLanguageConfiguration
} from '../../client/language/languageConfiguration';

const NEEDS_INDENT = [
    /^break$/,
    /^continue$/,
    /^raise$/,  // only re-raise
    /^return\b/
];
const INDENT_ON_MATCH = [
    /^async\s+def\b/,
    /^class\b/,
    /^def\b/,
    /^with\b/,
    /^try\b/,
    /^except\b/,
    /^finally\b/,
    /^while\b/,
    /^for\b/,
    /^if\b/,
    /^elif\b/,
    /^else\b/
];
const DEDENT_ON_MATCH = [
    /^elif\b/,
    /^else\b/,
    /^except\b/,
    /^finally\b/
];
const DEDENT_ON_ENTER = [
    /^break$/,
    /^continue$/,
    /^raise\b/,
    /^return$/,
    /^pass\b/
];

function isMember(line: string, regexes: RegExp[]): boolean {
    for (const regex of regexes) {
        if (regex.test(line)) {
            return true;
        }
    }
    return false;
}

suite('Language configuration regexes', () => {
    const cfg = getLanguageConfiguration();
    const MULTILINE_SEPARATOR_INDENT_REGEX = cfg.onEnterRules[0].beforeText;
    const DECREASE_INDENT_REGEX = cfg.indentationRules.decreaseIndentPattern;
    const INCREASE_INDENT_REGEX = cfg.indentationRules.increaseIndentPattern;
    const OUTDENT_ONENTER_REGEX = cfg.onEnterRules[2].beforeText;
    // To see the actual (non-verbose) regex patterns, un-comment here:
    //console.log(DECREASE_INDENT_REGEX.source);
    //console.log(INCREASE_INDENT_REGEX.source);
    //console.log(OUTDENT_ONENTER_REGEX.source);

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
        // compound statements
        'async def test(self):',
        'async def :',
        'async :',
        'class Test:',
        'class Test(object):',
        'class :',
        'def spam():',
        'def spam(self, node, namespace=""):',
        'def :',
        'for item in items:',
        'for item in :',
        'for :',
        'if foo is None:',
        'if :',
        'try:',
        'while \'::\' in macaddress:',
        'while :',
        'with self.test:',
        'with :',
        'elif x < 5:',
        'elif :',
        'else:',
        //'else if x < 5:',
        'except TestError:',
        'except :',
        'finally:',
        // simple statemenhts
        'pass',
        'raise Exception(msg)',
        'raise Exception',
        'raise',  // re-raise
        'break',
        'continue',
        'return',
        'return True',
        'return (True, False, False)',
        'return [True, False, False]',
        'return {True, False, False}',
        'return (',
        'return [',
        'return {',
        'return',
        // bogus
        '',
        ' ',
        '  '
    ].forEach(base => {
        [
            ['', '', '', ''],
            // leading
            ['    ', '', '', ''],
            ['   ', '', '', ''],  // unusual indent
            ['\t\t', '', '', ''],
            // pre-keyword
            ['x', '', '', ''],
            // post-keyword
            ['', 'x', '', ''],
            // pre-colon
            ['', '', ' ', ''],
            // trailing
            ['', '', '', ' '],
            ['', '', '', '# a comment'],
            ['', '', '', ' # ...']
        ].forEach(whitespace => {
            const [leading, postKeyword, preColon, trailing] = whitespace;
            let invalid: string | undefined;
            if (base.trim() === '') {
                invalid = 'blank line';
            } else if (leading === '' && isMember(base, NEEDS_INDENT)) {
                invalid = 'expected indent';
            } else if (leading.trim() !== '') {
                invalid = 'look-alike - pre-keyword';
            } else if (postKeyword.trim() !== '') {
                invalid = 'look-alike - post-keyword';
            }

            let resolvedBase = base;
            if (postKeyword !== '') {
                if (resolvedBase.includes(' ')) {
                    const kw = resolvedBase.split(' ', 1)[0];
                    const remainder = resolvedBase.substring(kw.length);
                    resolvedBase = `${kw}${postKeyword} ${remainder}`;
                } else {
                    if (resolvedBase.endsWith(':')) {
                        resolvedBase = `${resolvedBase.substring(0, resolvedBase.length - 1)}${postKeyword}:`;
                    } else {
                        resolvedBase = `${resolvedBase}${postKeyword}`;
                    }
                }
            }
            if (preColon !== '') {
                if (resolvedBase.endsWith(':')) {
                    resolvedBase = `${resolvedBase.substring(0, resolvedBase.length - 1)}${preColon}:`;
                } else {
                    return;
                }
            }
            const example = `${leading}${resolvedBase}${trailing}`;

            if (invalid) {
                test(`Line "${example}" ignored (${invalid})`, () => {
                    let result = INCREASE_INDENT_REGEX.test(example);
                    expect(result).to.be.equal(false, 'unexpected match');

                    result = DECREASE_INDENT_REGEX.test(example);
                    expect(result).to.be.equal(false, 'unexpected match');

                    result = OUTDENT_ONENTER_REGEX.test(example);
                    expect(result).to.be.equal(false, 'unexpected match');
                });
                return;
            }

            test(`Check indent-on-match for line "${example}"`, () => {
                let expected = false;
                if (isMember(base, INDENT_ON_MATCH)) {
                    expected = true;
                }

                const result = INCREASE_INDENT_REGEX.test(example);

                expect(result).to.be.equal(expected, 'unexpected result');
            });

            test(`Check dedent-on-match for line "${example}"`, () => {
                let expected = false;
                if (isMember(base, DEDENT_ON_MATCH)) {
                    expected = true;
                }

                const result = DECREASE_INDENT_REGEX.test(example);

                expect(result).to.be.equal(expected, 'unexpected result');
            });

            test(`Check dedent-on-enter for line "${example}"`, () => {
                let expected = false;
                if (isMember(base, DEDENT_ON_ENTER)) {
                    expected = true;
                }

                const result = OUTDENT_ONENTER_REGEX.test(example);

                expect(result).to.be.equal(expected, 'unexpected result');
            });
        });
    });
});
