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
        const hash = crypto.createHash('blabla', 'number');
        assert.typeOf(hash, 'number', 'Type should be a number');
    });
    test('If hashFormat equals `string`, method createHash() returns a string', async () => {
        const hash = crypto.createHash('blabla', 'string');
        assert.typeOf(hash, 'string', 'Type should be a string');
    });
    test('If hashFormat equals `number`, the hash should not be NaN', async () => {
        let hash = crypto.createHash('test', 'number');
        assert.isNotNaN(hash, 'Number hash should not be NaN');
        hash = crypto.createHash('hash', 'number');
        assert.isNotNaN(hash, 'Number hash should not be NaN');
        hash = crypto.createHash('HASH1', 'number');
        assert.isNotNaN(hash, 'Number hash should not be NaN');
    });
    test('If hashFormat equals `string`, the hash should not be undefined', async () => {
        let hash = crypto.createHash('test', 'string');
        assert.isDefined(hash, 'String hash should not be undefined');
        hash = crypto.createHash('hash', 'string');
        assert.isDefined(hash, 'String hash should not be undefined');
        hash = crypto.createHash('HASH1', 'string');
        assert.isDefined(hash, 'String hash should not be undefined');
    });
    test('If hashFormat equals `number`, hashes with different data should return different number hashes', async () => {
        const hash1 = crypto.createHash('hash1', 'number');
        const hash2 = crypto.createHash('hash2', 'number');
        assert.notEqual(hash1, hash2, 'Hashes should be different numbers');
    });
    test('If hashFormat equals `string`, hashes with different data should return different string hashes', async () => {
        const hash1 = crypto.createHash('hash1', 'string');
        const hash2 = crypto.createHash('hash2', 'string');
        assert.notEqual(hash1, hash2, 'Hashes should be different strings');
    });
});
