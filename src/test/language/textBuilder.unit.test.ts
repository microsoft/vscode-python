// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import { TextBuilder } from '../../client/language/textBuilder';

suite('Language.TextBuilder', () => {
    test('Test get text.', () => {
        const builder = new TextBuilder();
        builder.append('red');
        builder.append(' ');
        builder.append('green');
        builder.append(' ');
        builder.append('blue');
        assert.equal(builder.getText(), 'red green blue');
    });
    test('Test get text with ending whitespace.', () => {
        const builder = new TextBuilder();
        builder.append('red');
        builder.append(' ');
        builder.append('green');
        builder.append(' ');
        builder.append('blue');
        builder.append(' '); // it should skip this
        assert.equal(builder.getText(), 'red green blue');
    });
    test('Test soft append whitespace to empty string.', () => {
        const builder = new TextBuilder();
        builder.softAppendSpace(1);
        builder.append('red');
        assert.equal(builder.getText(), 'red');
    });
    test('Test soft append multiple whitespace.', () => {
        const builder = new TextBuilder();
        builder.append('red');
        builder.softAppendSpace(2);
        builder.append('green');
        assert.equal(builder.getText(), 'red  green');
    });
    test('Test soft append multiple whitespace, with existing whitespace.', () => {
        const builder = new TextBuilder();
        builder.append('red');
        builder.append(' ');
        builder.softAppendSpace(2);
        builder.append('green');
        assert.equal(builder.getText(), 'red  green');
    });
});
