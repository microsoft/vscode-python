// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any no-require-imports no-var-requires

import { expect } from 'chai';
import { Position, Range } from 'vscode';
import { parsePosition, parseRange } from '../../../client/common/utils/text';

suite('parseRange()', () => {
    test('valid strings', async () => {
        const tests: [string, Range][] = [
            ['1:5-3:5', new Range(new Position(1, 5), new Position(3, 5))],
            ['1:5-3:3', new Range(new Position(1, 5), new Position(3, 3))],
            ['1:3-3:5', new Range(new Position(1, 3), new Position(3, 5))],
            ['1-3:5', new Range(new Position(1, 0), new Position(3, 5))],
            ['1-3', new Range(new Position(1, 0), new Position(3, 0))],
            ['1-1', new Range(new Position(1, 0), new Position(1, 0))],
            ['1', new Range(new Position(1, 0), new Position(1, 0))],
            [
                '1:3-',
                new Range(
                    new Position(1, 3),
                    new Position(0, 0), // ???
                ),
            ],
            ['1:3', new Range(new Position(1, 3), new Position(1, 3))],
            ['', new Range(new Position(0, 0), new Position(0, 0))],
            ['3-1', new Range(new Position(3, 0), new Position(1, 0))],
        ];
        for (const [raw, expected] of tests) {
            const result = parseRange(raw);

            expect(result).to.deep.equal(expected);
        }
    });
    test('valid numbers', async () => {
        const tests: [number, Range][] = [[1, new Range(new Position(1, 0), new Position(1, 0))]];
        for (const [raw, expected] of tests) {
            const result = parseRange(raw);

            expect(result).to.deep.equal(expected);
        }
    });
    test('bad strings', async () => {
        const tests: string[] = [
            '1-2-3',
            '1:4-2-3',
            '1-2:4-3',
            '1-2-3:4',

            '1:2:3',
            '1:2:3-4',
            '1-2:3:4',
            '1:2:3-4:5:6',

            '1-a',
            '1:2-a',
            '1-a:2',
            '1:2-a:2',
            'a-1',
            'a-b',
            'a',
            'a:1',
            'a:b',
        ];
        for (const raw of tests) {
            expect(() => parseRange(raw)).to.throw();
        }
    });
});

suite('parsePosition()', () => {
    test('valid strings', async () => {
        const tests: [string, Position][] = [
            ['1:5', new Position(1, 5)],
            ['1', new Position(1, 0)],
            ['', new Position(0, 0)],
        ];
        for (const [raw, expected] of tests) {
            const result = parsePosition(raw);

            expect(result).to.deep.equal(expected);
        }
    });
    test('valid numbers', async () => {
        const tests: [number, Position][] = [[1, new Position(1, 0)]];
        for (const [raw, expected] of tests) {
            const result = parsePosition(raw);

            expect(result).to.deep.equal(expected);
        }
    });
    test('bad strings', async () => {
        const tests: string[] = ['1:2:3', '1:a', 'a'];
        for (const raw of tests) {
            expect(() => parsePosition(raw)).to.throw();
        }
    });
});
