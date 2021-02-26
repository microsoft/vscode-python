// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import * as path from 'path';
import { Architecture, getOSType, OSType } from '../../../../../client/common/utils/platform';
import {
    PythonEnvInfo,
    PythonEnvKind,
    PythonEnvSource,
    PythonExecutableInfo,
    UNKNOWN_PYTHON_VERSION,
} from '../../../../../client/pythonEnvironments/base/info';
import { PythonLocatorQuery } from '../../../../../client/pythonEnvironments/base/locator';
import { WindowsPathEnvVarLocator } from '../../../../../client/pythonEnvironments/base/locators/lowLevel/windowsKnownPathsLocator';
import { ensureFSTree } from '../../../../utils/fs';
import { createNamedEnv, getEnvs, sortedEnvs } from '../../common';

const IS_WINDOWS = getOSType() === OSType.Windows;

const EMPTY_EXECUTABLE: PythonExecutableInfo = {
    filename: '',
    ctime: -1,
    mtime: -1,
    sysPrefix: '',
};

function getEnv(
    // These will all be provided.
    name: string,
    version: string,
    executable: string,
): PythonEnvInfo {
    const env = createNamedEnv(name, version, PythonEnvKind.Unknown, executable);
    env.arch = Architecture.Unknown;
    env.source = [PythonEnvSource.PathEnvVar];
    return env;
}

suite('Python envs locator - WindowsPathEnvVarLocator', async () => {
    let cleanUps: (() => void)[];

    const ENV_VAR = 'Path';

    const datadir = path.join(__dirname, '.data');
    const ROOT1 = path.join(datadir, 'root1');
    const ROOT2 = path.join(datadir, 'parent', 'root2');
    const ROOT3 = path.join(datadir, 'root3');
    const ROOT4 = path.join(datadir, 'root4');
    const ROOT5 = path.join(datadir, 'root5');
    const ROOT6 = path.join(datadir, 'root6');
    const DOES_NOT_EXIST = path.join(datadir, '.does-not-exist');
    const dataTree = `
        ./.data/
           root1/
              python2.exe  # matches on Windows (not actually executable though)
              <python.exe>
              <python2.7.exe>
              <python3.exe>
              <python3.8.exe>
              <python3.8>
              <python3.8.1rc1.10213.exe>  # should match but doesn't
              #<python27.exe>
              #<python38.exe>
              <python.3.8.exe>  # should match but doesn't
              python.txt
              <my-python.exe>  # should match but doesn't
              <spam.exe>
              spam.txt
           parent/
              root2/
                 <python2.exe>
                 <python2>
           root3/  # empty
           root4/  # no executables
              subdir/
              spam.txt
              python2
              #python.exe  # matches on Windows (not actually executable though)
           root5/  # executables only in subdir
              subdir/
                 <python2.exe>
                 <python2>
              python2
              #python2.exe  # matches on Windows (not actually executable though)
           root6/  # no matching executables
              <spam.exe>
              spam.txt
              <py>
              <py.exe>
    `.trimEnd();

    suiteSetup(async function () {
        if (!IS_WINDOWS) {
            if (!process.env.PVSC_TEST_FORCE) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }
            // tslint:disable:no-require-imports
            // eslint-disable-next-line global-require
            const sinon = require('sinon');
            // eslint-disable-next-line global-require
            const platformAPI = require('../../../../../client/common/utils/platform');
            // tslint:enable:no-require-imports
            const stub = sinon.stub(platformAPI, 'getOSType');
            stub.returns(OSType.Windows);
        }

        await ensureFSTree(dataTree, __dirname);
    });
    setup(() => {
        cleanUps = [];

        const oldSearchPath = process.env[ENV_VAR];
        cleanUps.push(() => {
            process.env[ENV_VAR] = oldSearchPath;
        });
    });
    teardown(() => {
        cleanUps.forEach((run) => {
            try {
                run();
            } catch (err) {
                // tslint:disable-next-line:no-console
                console.log(err);
            }
        });
    });

    function getActiveLocator(...roots: string[]): WindowsPathEnvVarLocator {
        process.env[ENV_VAR] = roots.join(path.delimiter);
        const locator = new WindowsPathEnvVarLocator();
        cleanUps.push(() => locator.dispose());
        return locator;
    }

    suite('iterEnvs()', () => {
        test('no executables found', async () => {
            const expected: PythonEnvInfo[] = [];
            const locator = getActiveLocator(ROOT3, ROOT4, DOES_NOT_EXIST, ROOT5);
            const query: PythonLocatorQuery | undefined = undefined;

            const iterator = locator.iterEnvs(query);
            const envs = await getEnvs(iterator);

            assert.deepEqual(envs, expected);
        });

        test('no executables match', async () => {
            const expected: PythonEnvInfo[] = [];
            const locator = getActiveLocator(ROOT6, DOES_NOT_EXIST);
            const query: PythonLocatorQuery | undefined = undefined;

            const iterator = locator.iterEnvs(query);
            const envs = await getEnvs(iterator);

            assert.deepEqual(envs, expected);
        });

        test('some executables match', async () => {
            const expected: PythonEnvInfo[] = [
                getEnv('', '', path.join(ROOT1, 'python.exe')),

                // We will expect the following once we switch
                // to a better filter than isStandardPythonBinary().

                // // On Windows we do not assume 2.7 for "python.exe".
                // getEnv('', '2.7', path.join(ROOT2, 'python2.exe')),
                // // This file isn't executable (but on Windows we can't tell that):
                // getEnv('', '2.7', path.join(ROOT1, 'python2.exe')),
                // getEnv('', '', path.join(ROOT1, 'python.exe')),
                // getEnv('', '2.7', path.join(ROOT1, 'python2.7.exe')),
                // getEnv('', '3.8', path.join(ROOT1, 'python3.8.exe')),
                // getEnv('', '3', path.join(ROOT1, 'python3.exe')),
            ];
            const locator = getActiveLocator(ROOT2, ROOT6, ROOT1);
            const query: PythonLocatorQuery | undefined = undefined;

            const iterator = locator.iterEnvs(query);
            const envs = await getEnvs(iterator);

            assert.deepEqual(sortedEnvs(envs), sortedEnvs(expected));
        });
    });

    suite('resolveEnv()', () => {
        test('found using filename', async () => {
            const filename = path.join(ROOT1, 'python.exe');
            const expected = getEnv('', '', filename);
            // We will expect the following once we switch
            // to a better filter than isStandardPythonBinary().
            //
            // const filename = path.join(ROOT1, 'python3.8.exe');
            // const expected = getEnv('', '3.8', filename);
            const locator = getActiveLocator(ROOT2, ROOT6, ROOT1);

            const resolved = await locator.resolveEnv(filename);

            assert.deepEqual(resolved, expected);
        });

        test('found using env info', async () => {
            const filename = path.join(ROOT1, 'python.exe');
            const env = {
                kind: PythonEnvKind.Unknown,
                name: '',
                location: '',
                executable: { ...EMPTY_EXECUTABLE, filename },
                source: [],
                version: UNKNOWN_PYTHON_VERSION,
                arch: Architecture.Unknown,
                distro: { org: '' },
            };
            const expected = getEnv('', '', filename);
            // We will expect the following once we switch
            // to a better filter than isStandardPythonBinary().
            //
            // const filename = path.join(ROOT1, 'python3.8.exe');
            // const env = {
            //     executable: { ...EMPTY_EXECUTABLE, filename },
            // };
            // const expected = getEnv('', '3.8', filename);
            const locator = getActiveLocator(ROOT2, ROOT6, ROOT1);

            const resolved = await locator.resolveEnv(env as PythonEnvInfo);

            assert.deepEqual(resolved, expected);
        });

        [
            // We run through these as a sanity check.
            path.join(ROOT2, 'python2.exe'),
            path.join(ROOT1, 'python3.8.exe'),
            path.join(ROOT1, 'python3.8.1rc1.10213.exe'),
            path.join(ROOT1, 'my-python.exe'),
            path.join(ROOT4, 'python2.exe'),
            path.join(ROOT5, 'subdir', 'python2.exe'),
            path.join(ROOT6, 'spam.exe'),
            path.join(ROOT6, 'py.exe'),
        ].forEach((executable) => {
            test(`no executables found (${executable})`, async () => {
                const locator = getActiveLocator(ROOT3, ROOT4, DOES_NOT_EXIST, ROOT5);

                const resolved = await locator.resolveEnv(executable);

                assert.equal(resolved, undefined);
            });
        });

        [
            path.join(ROOT2, 'python2.exe'),
            path.join(ROOT1, 'python3.8.exe'),
            path.join(ROOT5, 'subdir', 'python2.exe'),
        ].forEach((executable) => {
            test(`wrong search path entries (${executable})`, async () => {
                const locator = getActiveLocator(ROOT6, ROOT5, DOES_NOT_EXIST);

                const resolved = await locator.resolveEnv(executable);

                assert.equal(resolved, undefined);
            });
        });

        [
            path.join(ROOT1, 'python3.8.1rc1.10213.exe'), // does not match regex
            path.join(ROOT1, 'my-python.exe'), // does not match regex
            path.join(ROOT6, 'spam.exe'), // does not match regex
            path.join(ROOT6, 'py.exe'), // does not match regex
        ].forEach((executable) => {
            test(`does not match regex (${executable})`, async () => {
                const locator = getActiveLocator(ROOT6, ROOT1, DOES_NOT_EXIST);

                const resolved = await locator.resolveEnv(executable);

                assert.equal(resolved, undefined);
            });
        });

        [
            path.join(ROOT4, 'python2.exe'), // not executable
        ].forEach((executable) => {
            test(`not executable (${executable})`, async () => {
                const locator = getActiveLocator(ROOT4, DOES_NOT_EXIST);

                const resolved = await locator.resolveEnv(executable);

                assert.equal(resolved, undefined);
            });
        });

        [
            '',
            { name: 'env1' }, // matches an env but resolveEnv() doesn't care
            {},
        ].forEach((env) => {
            test(`missing executable (${env})`, async () => {
                const locator = getActiveLocator(ROOT2, ROOT6, ROOT1);

                const resolved = await locator.resolveEnv(env as string | PythonEnvInfo);

                assert.equal(resolved, undefined);
            });
        });

        test('multiple calls', async () => {
            const expected: (PythonEnvInfo | undefined)[] = [
                undefined,
                undefined,
                undefined,
                getEnv('', '', path.join(ROOT1, 'python.exe')),
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,

                // We will expect the following once we switch
                // to a better filter than isStandardPythonBinary().

                // getEnv('', '2.7', path.join(ROOT2, 'python2.exe')),
                // undefined,
                // undefined,
                // getEnv('', '', path.join(ROOT1, 'python.exe')),
                // getEnv('', '2.7', path.join(ROOT1, 'python2.7.exe')),
                // getEnv('', '3.8', path.join(ROOT1, 'python3.8.exe')),
                // undefined,
                // undefined,
                // undefined,
                // undefined,
                // getEnv('', '3.8', path.join(ROOT1, 'python3.8.exe')),
                // undefined,
                // undefined,
            ];
            const executables = [
                path.join(ROOT2, 'python2.exe'),
                path.join(ROOT1, 'python3.8.1rc1.10213.exe'), // does not match regex
                path.join(ROOT1, 'my-python.exe'), // does not match regex
                path.join(ROOT1, 'python.exe'),
                path.join(ROOT1, 'python2.7.exe'),
                path.join(ROOT1, 'python3.8.exe'),
                path.join(ROOT4, 'python.exe'), // not executable
                path.join(ROOT5, 'subdir', 'python.exe'), // non on $PATH
                path.join(ROOT6, 'spam.exe'), // does not match regex
                path.join(ROOT6, 'py.exe'), // does not match regex
                {
                    executable: {
                        ...EMPTY_EXECUTABLE,
                        filename: path.join(ROOT1, 'python3.8.exe'),
                    },
                },
                { name: 'env1' }, // matches an env but resolveEnv() doesn't care
                {},
            ];
            const locator = getActiveLocator(ROOT2, ROOT6, ROOT1);

            const envs = await Promise.all(
                // Each executable is resolved.
                executables.map((exe) => locator.resolveEnv(exe as string | PythonEnvInfo)),
            );

            assert.deepEqual(envs, expected);
        });
    });

    // Once the locator has an FS watcher, we will need to add
    // a test to verify that FS or env var changes cause the
    // locator to refresh and emit an event.  Until then there
    // really isn't much to test with `locator.onChanged`.
});
