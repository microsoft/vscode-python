// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';

import { parseExeVersion } from '../../../../client/pythonEnvironments/base/info/executable';
import { getEmptyVersion } from '../../../../client/pythonEnvironments/base/info/pythonVersion';
import { ver } from './pythonVersion.unit.test';

suite('pyenvs info - parseExeVersion', () => {
    suite('could not infer version', () => {
        const BOGUS_EXECUTABLES = [
            // almost okay
            'py',
            'py2',
            'py27',
            'py2.7',
            'py-2.7',
            'foo27',
            'foo2.7',
            '27',
            '2.7',
            'foopython27',
            '/x/y/z/python27/exe',
            // clearly no version
            'foo',
            'foo7x',
            'foo7',
            '',
        ];
        const expected = getEmptyVersion();
        for (const info of BOGUS_EXECUTABLES) {
            const executable = info;
            test(`executable filename does not have version (${executable})`, () => {
                const version = parseExeVersion(executable, { ignoreErrors: true });

                assert.deepEqual(version, expected);
            });
        }
    });

    const EXECUTABLES: [string, number, number | undefined][] = [
        ['python27', 2, 7],
        ['python2.7', 2, 7],
        ['python-27', 2, 7],
        ['python-2.7', 2, 7],
        ['python35', 3, 5],
        // case doesn't matter
        ['Python27', 2, 7],
        ['PYTHON27', 2, 7],
        // implied values
        ['python', 2, 7],
        ['python2', 2, 7],
        ['python3', 3, undefined],
    ];
    for (const info of EXECUTABLES) {
        const [text, major, minor] = info;
        const expected = ver(major, minor, undefined);

        test(`executable filename has version (${text})`, () => {
            const version = parseExeVersion(text);

            assert.deepEqual(version, expected);
        });

        test(`executable filename has version (${text}.exe)`, () => {
            const version = parseExeVersion(text);

            assert.deepEqual(version, expected);
        });
    }
});
