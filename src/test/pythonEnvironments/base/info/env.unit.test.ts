// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { Architecture } from '../../../../client/common/utils/platform';
import { parseVersionInfo } from '../../../../client/common/utils/version';
import { PythonEnvInfo, PythonDistroInfo, PythonEnvKind } from '../../../../client/pythonEnvironments/base/info';
import { getEnvDisplayString } from '../../../../client/pythonEnvironments/base/info/env';
import { createLocatedEnv } from '../common';

suite('pyenvs info - getEnvDisplayString()', () => {
    function getEnv(info: {
        version?: string;
        arch?: Architecture;
        name?: string;
        kind?: PythonEnvKind;
        distro?: PythonDistroInfo;
        display?: string;
        defaultDisplayName?: string;
        location?: string;
    }): PythonEnvInfo {
        const env = createLocatedEnv(
            info.location || '',
            info.version || '',
            info.kind || PythonEnvKind.Unknown,
            'python', // exec
            info.distro,
        );
        env.name = info.name || '';
        env.arch = info.arch || Architecture.Unknown;
        env.display = info.display;
        env.defaultDisplayName = info.defaultDisplayName;
        return env;
    }

    suite('cached', () => {
        suite('already resolved', () => {
            [
                'Python', // built: absolute minimal
                'Python 3.7.x x64 (my-env: venv)', // built: full
                'spam',
                'some env',
                // corner cases
                '---',
                '  ',
            ].forEach((display: string) => {
                test(`"${display}"`, () => {
                    const expected = display;
                    const env = getEnv({ display });

                    const result = getEnvDisplayString(env);

                    assert.equal(result, expected);
                });
            });
        });

        suite('has default', () => {
            const defaultDisplayName = 'my-env (some-kind)';

            test('without "display"', () => {
                const expected = defaultDisplayName;
                const env = getEnv({ defaultDisplayName });

                const result = getEnvDisplayString(env);

                assert.equal(result, expected);
            });

            test('with empty "display"', () => {
                const expected = defaultDisplayName;
                const env = getEnv({ defaultDisplayName, display: '' });

                const result = getEnvDisplayString(env);

                assert.equal(result, expected);
            });
        });

        test('both', () => {
            const display = 'Python 3.7.3 (system)';
            const defaultDisplayName = 'my-env (some-kind)';
            const expected = display;
            const env = getEnv({ display, defaultDisplayName });

            const result = getEnvDisplayString(env);

            assert.equal(result, expected);
        });
    });

    suite('built', () => {
        const name = 'my-env';
        const location = 'x/y/z/spam/';
        const arch = Architecture.x64;
        const version = '3.8.1';
        const kind = PythonEnvKind.Venv;
        const distro: PythonDistroInfo = {
            org: 'Distro X',
            defaultDisplayName: 'distroX 1.2',
            version: parseVersionInfo('1.2.3')?.version,
            binDir: 'distroX/bin',
        };
        const tests: [PythonEnvInfo, string][] = [
            [getEnv({}), 'Python'],
            [getEnv({ version, arch, name, kind, distro }), "Python 3.8.1 64-bit ('my-env': venv)"],
            // without "suffix" info
            [getEnv({ version }), 'Python 3.8.1'],
            [getEnv({ arch }), 'Python 64-bit'],
            [getEnv({ version, arch }), 'Python 3.8.1 64-bit'],
            // with "suffix" info
            [getEnv({ name }), "Python ('my-env')"],
            [getEnv({ kind }), 'Python (venv)'],
            [getEnv({ name, kind }), "Python ('my-env': venv)"],
            // env.location is ignored.
            [getEnv({ location }), 'Python'],
            [getEnv({ name, location }), "Python ('my-env')"],
        ];
        tests.forEach(([env, expected]) => {
            test(`"${expected}"`, () => {
                const result = getEnvDisplayString(env);

                assert.equal(result, expected);
            });
        });
    });
});
