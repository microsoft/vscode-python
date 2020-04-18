// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { encode, encodingExists } from 'iconv-lite';
import { BufferDecoder } from '../../../client/common/process/decoder';
import { initialize } from './../../initialize';

suite('Decoder', () => {
    setup(initialize);
    teardown(initialize);

    test('Test decoding utf8 strings', () => {
        const value = 'Sample input string Сделать это';
        const buffer = encode(value, 'utf8');
        const decoder = new BufferDecoder();
        const decodedValue = decoder.decode([buffer]);
        expect(decodedValue).equal(value, 'Decoded string is incorrect');
    });

    test('Test decoding cp932 strings', function () {
        if (!encodingExists('cp866')) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        const value = 'Sample input string Сделать это';
        const buffer = encode(value, 'cp866');
        const decoder = new BufferDecoder();
        let decodedValue = decoder.decode([buffer]);
        expect(decodedValue).not.equal(value, 'Decoded string is the same');

        decodedValue = decoder.decode([buffer], 'cp866');
        expect(decodedValue).equal(value, 'Decoded string is incorrect');
    });
});
