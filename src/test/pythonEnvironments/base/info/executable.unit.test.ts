// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';

import { Disposables } from '../../../../client/common/utils/resourceLifecycle';
import { parseExeVersion } from '../../../../client/pythonEnvironments/base/info/executable';
import { getEmptyVersion } from '../../../../client/pythonEnvironments/base/info/pythonVersion';
import * as osUtils from '../../../utils/os';
import { ver } from './pythonVersion.unit.test';

suite('pyenvs info - parseExeVersion', () => {
    const disposables = new Disposables();

    teardown(async () => {
        await disposables.dispose();
    });

    function setNonWindows() {
        disposables.push({ dispose: osUtils.setNonWindows() });
    }
    function setWindows() {
        disposables.push({ dispose: osUtils.setWindows() });
    }

    suite('infer version from basename', () => {
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
            ['python2', 2, 7],
            ['python3', 3, undefined],
            // directory does not match
            ['/x/y/z/python2/bin/python3', 3, undefined],
        ];
        for (const info of EXECUTABLES) {
            const [text, major, minor] = info;
            const textExe = `${text}.exe`;
            const expected = ver(major, minor, undefined);

            test(`executable filename has version (${text}, non-Windows)`, () => {
                setNonWindows();

                const version = parseExeVersion(text);

                assert.deepEqual(version, expected);
            });

            test(`executable filename has version (${textExe}, Windows)`, () => {
                setWindows();

                const version = parseExeVersion(textExe);

                assert.deepEqual(version, expected);
            });
        }
    });

    suite('infer version from directory', () => {
        const EXECUTABLES: [string, number, number | undefined][] = [
            ['/x/y/z/python3.7/bin/python', 3, 7],
            ['/x/y/z/python/3.7/bin/python', 3, 7],
            ['/x/y/z/python37/bin/python3', 3, 7],
            ['/x/y/z/python3/python', 3, undefined],
        ];
        for (const info of EXECUTABLES) {
            const [text, major, minor] = info;
            const textExe = `${text}.exe`;
            const expected = ver(major, minor, undefined);

            test(`executable filename has version (${text}, non-Windows)`, () => {
                setNonWindows();

                const version = parseExeVersion(text);

                assert.deepEqual(version, expected);
            });

            test(`executable filename has version (${textExe}, Windows)`, () => {
                setWindows();

                const version = parseExeVersion(textExe);

                assert.deepEqual(version, expected);
            });
        }
    });

    suite('infer version from "python" basename', () => {
        [
            'python',
        ].forEach((text) => {
            const textExe = `${text}.exe`;

            test(`executable filename has version (${text}, non-Windows)`, () => {
                const expected = ver(2, 7, undefined);
                setNonWindows();

                const version = parseExeVersion(text);

                assert.deepEqual(version, expected);
            });

            test(`executable filename has version (${textExe}, Windows)`, () => {
                const expected = getEmptyVersion();
                setWindows();

                const version = parseExeVersion(textExe);

                assert.deepEqual(version, expected);
            });
        });
    });

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
});
