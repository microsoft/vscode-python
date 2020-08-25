// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';

import {
    getVersionString,
    isVersionInfoEmpty,
    normalizeVersionInfo,
    ParseResult,
    parseVersionInfo,
    validateVersionInfo,
    VersionInfo
} from '../../../client/common/utils/version';

const NOT_USED = {};

function ver(
    // tslint:disable:no-any
    major: any,
    minor: any = NOT_USED,
    micro: any = NOT_USED,
    // tslint:enable:no-any
    unnormalized?: VersionInfo
): VersionInfo {
    if (minor === NOT_USED) {
        minor = -1;
    }
    if (micro === NOT_USED) {
        micro = -1;
    }
    const info = {
        major: (major as unknown) as number,
        minor: (minor as unknown) as number,
        micro: (micro as unknown) as number,
        raw: undefined
    };
    if (unnormalized !== undefined) {
        // tslint:disable-next-line:no-any
        ((info as unknown) as any).unnormalized = unnormalized;
    }
    return info;
}

function res(
    // These go into the VersionInfo:
    major: number,
    minor: number,
    micro: number,
    // These are the remainder of the ParseResult:
    before: string,
    after: string
): ParseResult<VersionInfo> {
    return {
        before,
        after,
        version: ver(major, minor, micro)
    };
}

const VERSIONS: [VersionInfo, string][] = [
    [ver(2, 7, 0), '2.7.0'],
    [ver(2, 7, -1), '2.7'],
    [ver(2, -1, -1), '2'],
    [ver(-1, -1, -1), ''],
    [ver(2, 7, 11), '2.7.11'],
    [ver(3, 11, 1), '3.11.1'],
    [ver(0, 0, 0), '0.0.0']
];
const INVALID: VersionInfo[] = [
    ver(undefined, undefined, undefined),
    ver(null, null, null),
    ver({}, {}, {}),
    //ver('-1', '-1', '-1'),
    ver('x', 'y', 'z')
];

suite('common utils - getVersionString', () => {
    suite('valid', () => {
        VERSIONS.forEach((data) => {
            const [info, expected] = data;
            test(`${expected}`, () => {
                const result = getVersionString(info);

                assert.equal(result, expected);
            });
        });
    });

    suite('invalid', () => {
        INVALID.forEach((info) => {
            test(`[${info.major}, ${info.minor}, ${info.micro}]`, () => {
                const result = getVersionString(info);

                assert.equal(result, '');
            });
        });
    });
});

suite('common utils - isVersionEmpty', () => {
    [
        ver(-1, -1, -1),
        // normalization failed:
        ver(-1, -1, -1, ver(null, null, null)),
        // not normalized by still empty
        ver(-10, -10, -10)
    ].forEach((data: VersionInfo) => {
        const info = data;
        test(`empty: ${info}`, () => {
            const result = isVersionInfoEmpty(info);

            assert.ok(result);
        });
    });

    [
        // clearly not empty:
        ver(3, 4, 5),
        ver(3, 4, -1),
        ver(3, -1, -1),
        // 0 is not empty:
        ver(0, 0, 0),
        ver(0, 0, -1),
        ver(0, -1, -1)
    ].forEach((data: VersionInfo) => {
        const info = data;
        test(`not empty: ${info.major}.${info.minor}.${info.micro}`, () => {
            const result = isVersionInfoEmpty(info);

            assert.equal(result, false);
        });
    });

    INVALID.forEach((data: VersionInfo) => {
        const info = data;
        test(`bogus: ${info.major}`, () => {
            const result = isVersionInfoEmpty(info);

            assert.equal(result, false);
        });
    });
});

suite('common utils - normalizeVersionInfo', () => {
    test(`noop`, () => {
        const info = ver(1, 2, 3);
        info.raw = '1.2.3';
        // tslint:disable-next-line:no-any
        ((info as unknown) as any).unnormalized = { ...info };
        const expected = info;

        const normalized = normalizeVersionInfo(info);

        assert.deepEqual(normalized, expected);
    });

    test(`same`, () => {
        const info = ver(1, 2, 3);
        info.raw = '1.2.3';
        // tslint:disable-next-line:no-any
        const expected: any = { ...info };
        expected.unnormalized = { ...info };

        const normalized = normalizeVersionInfo(info);

        assert.deepEqual(normalized, expected);
    });

    test(`NaN`, () => {
        const info = ver(NaN, 2, 3);
        info.raw = '';
        // tslint:disable-next-line:no-any
        const expected: any = { ...info };
        expected.major = -1;
        expected.unnormalized = { ...info };

        const normalized = normalizeVersionInfo(info);

        // tslint:disable-next-line:no-any
        const raw = (normalized as unknown) as any;
        assert.ok(isNaN(raw.unnormalized?.major));
        raw.unnormalized.major = 1;
        expected.unnormalized.major = 1;
        assert.deepEqual(normalized, expected);
    });

    test('valid', () => {
        const info = ver(3, -1, -10);
        // tslint:disable-next-line:no-any
        const expected: any = ver(3, -1, -1);
        expected.raw = '';
        expected.unnormalized = { ...info };

        const normalized = normalizeVersionInfo(info);

        assert.deepEqual(normalized, expected);
    });

    test('empty', () => {
        const info = ver(-1, -5, -10);
        // tslint:disable-next-line:no-any
        const expected: any = ver(-1, -1, -1);
        expected.raw = '';
        expected.unnormalized = { ...info };

        const normalized = normalizeVersionInfo(info);

        assert.deepEqual(normalized, expected);
    });

    [
        [ver(3, null, undefined), ver(3, -1, -1)],
        [ver('', 4, '5'), ver(-1, 4, 5)],
        [ver({}, [], 5), ver(-1, -1, 5)]
    ].forEach((data) => {
        const [info, expected] = data;
        // tslint:disable-next-line:no-any
        ((expected as unknown) as any).unnormalized = info;
        expected.raw = '';
        test(`partially invalid: [${info.major}, ${info.minor}, ${info.micro}]`, () => {
            const normalized = normalizeVersionInfo(info);

            assert.deepEqual(normalized, expected);
        });
    });
});

suite('common utils - validateVersionInfo', () => {
    suite('valid', () => {
        [
            ver(3, 4, 5),
            ver(3, 4, -1),
            ver(3, -1, -1),
            // unnormalized but still valid:
            ver(3, -7, -11)
        ].forEach((info) => {
            test(`as-is: [${info.major}, ${info.minor}, ${info.micro}]`, () => {
                validateVersionInfo(info);
            });
        });

        [
            // Each of these normalizes to -1:
            NaN,
            '-1',
            '-10',
            -11,
            undefined,
            null
        ].forEach((value) => {
            const raw = ver(3, 4, value);
            const info = ver(3, 4, -1, raw);
            test(`normalization worked: [${raw.major}, ${raw.minor}, ${raw.micro}]`, () => {
                validateVersionInfo(info);
            });
        });
    });

    suite('invalid', () => {
        [
            // missing major:
            ver(-1, -1, -1),
            ver(-1, -1, 5),
            ver(-1, 4, -1),
            ver(-1, 4, 5),
            // missing minor:
            ver(3, -1, 5)
        ].forEach((info) => {
            test(`missing parts: [${info.major}.${info.minor}.${info.micro}]`, () => {
                assert.throws(() => validateVersionInfo(info));
            });
        });

        [
            // parseInt() -> NaN:
            '',
            ' ',
            '\n',
            'foo',
            // no equivalent number and no special-case:
            {},
            []
        ].forEach((value) => {
            const raw = ver(3, 4, value);
            const info = ver(3, 4, -1, raw);
            test(`normalization failed: [${raw.major}, ${raw.minor}, ${raw.micro}]`, () => {
                assert.throws(() => validateVersionInfo(info));
            });
        });

        [
            ...INVALID,
            // extra cases:
            ver(NaN, 4, 5)
        ].forEach((info) => {
            test(`bogus: [${info.major}, ${info.minor}, ${info.micro}]`, () => {
                assert.throws(() => validateVersionInfo(info));
            });
        });
    });
});

suite('common utils - parseVersionInfo', () => {
    suite('invalid versions', () => {
        const BOGUS = [
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
        for (const verStr of BOGUS) {
            test(`invalid - '${verStr}'`, () => {
                const result = parseVersionInfo(verStr);

                assert.equal(result, undefined);
            });
        }
    });

    suite('valid versions', () => {
        ([
            // plain
            ...VERSIONS.map(([v, s]) => [s, { version: v, before: '', after: '' }]),
            ['02.7', res(2, 7, -1, '', '')],
            ['2.07', res(2, 7, -1, '', '')],
            ['2.7.01', res(2, 7, 1, '', '')],
            // with before/after
            [' 2.7.9 ', res(2, 7, 9, ' ', ' ')],
            ['2.7.9-3.2.7', res(2, 7, 9, '', '-3.2.7')],
            ['python2.7.exe', res(2, 7, -1, 'python', '.exe')],
            ['1.2.3.4.5-x2.2', res(1, 2, 3, '', '.4.5-x2.2')],
            ['3.8.1a2', res(3, 8, 1, '', 'a2')],
            ['3.8.1-alpha2', res(3, 8, 1, '', '-alpha2')],
            [
                '3.7.5 (default, Nov  7 2019, 10:50:52) \\n[GCC 8.3.0]',
                res(3, 7, 5, '', ' (default, Nov  7 2019, 10:50:52) \\n[GCC 8.3.0]')
            ],
            ['python2', res(2, -1, -1, 'python', '')],
            // without the "before" the following won't match.
            ['python2.a', res(2, -1, -1, 'python', '.a')],
            ['python2.b7', res(2, -1, -1, 'python', '.b7')]
        ] as [string, ParseResult<VersionInfo>][]).forEach((data) => {
            const [verStr, result] = data;
            if (verStr === '') {
                return;
            }
            const expected = { ...result, version: { ...result.version } };
            expected.version.raw = verStr;
            test(`valid - '${verStr}'`, () => {
                const parsed = parseVersionInfo(verStr);

                assert.deepEqual(parsed, expected);
            });
        });
    });
});
