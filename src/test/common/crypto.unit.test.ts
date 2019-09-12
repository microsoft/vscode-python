// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect } from 'chai';
import * as path from 'path';
import { CryptoUtils } from '../../client/common/crypto';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { PlatformService } from '../../client/common/platform/platformService';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../constants';

// tslint:disable-next-line: max-func-body-length
suite('Crypto Utils', async () => {
    let crypto: CryptoUtils;
    const fs = new FileSystem(new PlatformService());
    const file = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'test', 'common', 'randomWords.txt');
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
    test('If hashFormat equals `number`, ensure numbers are uniformly distributed on scale from 0 to 100', async () => {
        const words = await fs.readFile(file);
        const wordList = words.split('\n');
        const buckets: number[] = Array(100).fill(0);
        const hashes = Array(10).fill(0);
        for (const w of wordList) {
            if (w.length === 0) {
                continue;
            }
            for (let i = 0; i < 10; i += 1) {
                const word = `${w}${i}`;
                const hash = crypto.createHash(word, 'number');
                buckets[hash % 100] += 1;
                hashes[i] = hash % 100;
            }
        }
        const expectedHits = wordList.length / 10;
        for (const hit of buckets) {
            expect(hit).to.lessThan(1.25 * expectedHits);
            expect(hit).to.greaterThan(0.75 * expectedHits);
        }
    });
    test('If hashFormat equals `number`, on a scale of 0 to 100, small difference in the input on average produce large differences (about 33) in the output ', async () => {
        const words = await fs.readFile(file);
        const wordList = words.split('\n');
        const buckets: number[] = Array(100).fill(0);
        let hashes: number[] = [];
        let totalDifference = 0;
        for (const w of wordList.slice(0, 10)) {
            hashes = [];
            totalDifference = 0;
            if (w.length === 0) {
                continue;
            }
            for (let i = 0; i < 10; i += 1) {
                const word = `${w}${i}`;
                const hash = crypto.createHash(word, 'number');
                buckets[hash % 100] += 1;
                hashes.push(hash % 100);
            }
            for (let i = 0; i < 10; i += 1) {
                const word = `${i}${w}`;
                const hash = crypto.createHash(word, 'number');
                buckets[hash % 100] += 1;
                hashes.push(hash % 100);
            }
            for (let i = 0; i < 26; i += 1) {
                const word = `${String.fromCharCode(97 + i)}${w}`;
                const hash = crypto.createHash(word, 'number');
                buckets[hash % 100] += 1;
                hashes.push(hash % 100);
            }
            for (let i = 0; i < 26; i += 1) {
                const word = `${w}${String.fromCharCode(97 + i)}`;
                const hash = crypto.createHash(word, 'number');
                buckets[hash % 100] += 1;
                hashes.push(hash % 100);
            }
            // tslint:disable: prefer-for-of
            for (let i = 0; i < hashes.length; i += 1) {
                for (let j = 0; j < hashes.length; j += 1) {
                    if (hashes[i] > hashes[j]) {
                        totalDifference += hashes[i] - hashes[j];
                    } else {
                        totalDifference += hashes[j] - hashes[i];
                    }
                }
            }
            const averageDifference = totalDifference / hashes.length / hashes.length;
            expect(averageDifference).to.lessThan(1.25 * 33);
            expect(averageDifference).to.greaterThan(0.75 * 33);
        }
    });
});
