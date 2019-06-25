// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { CryptoUtils } from '../../client/common/crypto';

suite('Crypto Utils', async () => {
    let crypto: CryptoUtils;
    setup(() => {
        crypto = new CryptoUtils();
    });
    test('If hashFormat equals `number`, method createHash() returns a number', async () => {
        const hash = crypto.createHash('blabla', 'hex', 'number');
        assert.typeOf(hash, 'number', 'Type should be a number');
    });
    test('If hashFormat equals `string`, method createHash() returns a string', async () => {
        const hash = crypto.createHash('blabla', 'hex', 'string');
        assert.typeOf(hash, 'string', 'Type should be a string');
    });
});
