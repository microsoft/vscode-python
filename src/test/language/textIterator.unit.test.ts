// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import { TextIterator } from '../../client/language/textIterator';

suite('Language.TextIterator', () => {
    test('Construction', async () => {
        const content = 'some text';
        const ti = new TextIterator(content);
        assert.equal(ti.length, content.length);
        assert.equal(ti.getText(), content);
    });
    test('Iteration', async () => {
        const content = 'some text';
        const ti = new TextIterator(content);
        for (let i = -2; i < content.length + 2; i += 1) {
            const ch = ti.charCodeAt(i);
            if (i < 0 || i >= content.length) {
                assert.equal(ch, 0);
            } else {
                assert.equal(ch, content.charCodeAt(i));
            }
        }
    });
});
