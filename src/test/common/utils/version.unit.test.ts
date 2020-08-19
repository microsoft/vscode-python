// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';

import { ParseResult, parseVersionInfo } from '../../../client/common/utils/version';

function res(
    major: number,
    minor: number | undefined,
    micro: number | undefined,
    before: string,
    after: string
): ParseResult {
    return {
        before,
        after,
        version: {
            major,
            minor: (minor as unknown) as number,
            micro: (micro as unknown) as number
        }
    };
}

const VERSIONS: [string, ParseResult][] = [
    // plain
    ['2.7.0', res(2, 7, 0, '', '')],
    ['2.7', res(2, 7, undefined, '', '')],
    ['02.7', res(2, 7, undefined, '', '')],
    ['2.07', res(2, 7, undefined, '', '')],
    ['2.7.01', res(2, 7, 1, '', '')],
    ['2.7.11', res(2, 7, 11, '', '')],
    ['3.11.1', res(3, 11, 1, '', '')],
    ['0.0.0', res(0, 0, 0, '', '')],
    // with before/after
    [' 2.7.9 ', res(2, 7, 9, ' ', ' ')],
    ['2.7.9-3.2.7', res(2, 7, 9, '', '-3.2.7')],
    ['python2.7.exe', res(2, 7, undefined, 'python', '.exe')],
    ['1.2.3.4.5-x2.2', res(1, 2, 3, '', '.4.5-x2.2')],
    ['3.8.1a2', res(3, 8, 1, '', 'a2')],
    ['3.8.1-alpha2', res(3, 8, 1, '', '-alpha2')],
    [
        '3.7.5 (default, Nov  7 2019, 10:50:52) \\n[GCC 8.3.0]',
        res(3, 7, 5, '', ' (default, Nov  7 2019, 10:50:52) \\n[GCC 8.3.0]')
    ],
    ['2', res(2, undefined, undefined, '', '')],
    ['python2', res(2, undefined, undefined, 'python', '')],
    // without the "before" the following won't match.
    ['python2.a', res(2, undefined, undefined, 'python', '.a')],
    ['python2.b7', res(2, undefined, undefined, 'python', '.b7')]
];

suite('common utils - parseVersionInfo', () => {
    suite('invalid versions', () => {
        const INVALID = [
            // Note that some of these are *almost* valid.
            '2.',
            '.2',
            '.2.7',
            'a',
            '2.a',
            '2.b7',
            '2-b.7',
            '2.7rc1',
            ''
        ];
        for (const verStr of INVALID) {
            test(`invalid - '${verStr}'`, () => {
                const result = parseVersionInfo(verStr);

                assert.equal(result, undefined);
            });
        }
    });

    for (const info of VERSIONS) {
        const [verStr, expected] = info;
        test(`valid - '${verStr}'`, () => {
            const result = parseVersionInfo(verStr);

            assert.deepEqual(result, expected);
        });
    }
});
