// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';

import { MULTILINE_SEPARATOR_INDENT_REGEX } from '../../client/language/languageConfiguration';

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
});
