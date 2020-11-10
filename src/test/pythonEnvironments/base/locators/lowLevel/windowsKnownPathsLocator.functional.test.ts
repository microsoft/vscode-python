// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import * as path from 'path';
import { Architecture, getOSType, OSType } from '../../../../../client/common/utils/platform';
import { PythonEnvInfo, PythonEnvKind } from '../../../../../client/pythonEnvironments/base/info';
import { PythonLocatorQuery } from '../../../../../client/pythonEnvironments/base/locator';
import {
    WindowsKnownPathsLocator,
} from '../../../../../client/pythonEnvironments/base/locators/lowLevel/windowsKnownPathsLocator';
import { ensureFSTree } from '../../../../utils/fs';
import { createNamedEnv, getEnvs } from '../../common';

// Set this to true to run on linux.
const RUN_ANY_OS = false;

function getEnv(
    name: string,
    version: string,
    executable: string,
): PythonEnvInfo {
    const env = createNamedEnv(name, version, PythonEnvKind.Unknown, executable);
    env.arch = Architecture.Unknown;
    env.executable.filename = env.executable.filename.toLowerCase();
    return env;
}

suite('Python envs locator - WindowsKnownPathsLocator', async () => {
    let cleanUps: (() => void)[];

    let ENV_VAR: string;

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
              python2.exe  # not executable
              <python.exe>
              <python2.7.exe>
              <python3.exe>
              <python3.8.exe>
              <python3.8>
              <python3.8.1rc1.10213.exe>  # should match but doesn't
              #<python27.exe>
              #<python38.exe>
              #<python.3.8.exe>
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
              python.exe
           root5/  # executables only in subdir
              subdir/
                 <python2.exe>
                 <python2>
              python2
              python2.exe
           root6/  # no matching executables
              <spam.exe>
              spam.txt
              <py>
              <py.exe>
    `.trimEnd();

    suiteSetup(async function () {
        if (RUN_ANY_OS) {
            // tslint:disable:no-require-imports
            // eslint-disable-next-line global-require
            const sinon = require('sinon');
            // eslint-disable-next-line global-require
            const platformAPI = require('../../../../../client/common/utils/platform');
            // tslint:enable:no-require-imports
            const stub = sinon.stub(platformAPI, 'getOSType');
            stub.returns(OSType.Windows);
        }
        if (getOSType() !== OSType.Windows) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }

        ENV_VAR = getOSType() === OSType.Windows ? 'Path' : 'PATH';

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

    function setSearchPath(dirnames: string[]): void {
        process.env[ENV_VAR] = dirnames.join(path.delimiter);
    }

    suite('no executables found', () => {
        test('iterEnvs()', async () => {
            const expected: PythonEnvInfo[] = [];
            const locator = new WindowsKnownPathsLocator();
            setSearchPath([ROOT3, ROOT4, DOES_NOT_EXIST, ROOT5]);
            await locator.initialize();
            // Once the locator has an FS watcher, we will need to stop it:
            //   cleanUps.push(() => locator.dispose());
            const query: PythonLocatorQuery | undefined = undefined;

            const iterator = locator.iterEnvs(query);
            const envs = await getEnvs(iterator);

            assert.deepEqual(envs, expected);
        });

        test('resolveEnv()', async () => {
            const executables = [
                path.join(ROOT2, 'python2.exe'),
                path.join(ROOT1, 'python3.8.exe'),
                path.join(ROOT1, 'python3.8.1rc1.10213.exe'), // does not match regex
                path.join(ROOT1, 'my-python.exe'), // does not match regex
                path.join(ROOT4, 'python2.exe'), // not executable
                path.join(ROOT5, 'subdir', 'python2.exe'), // not on $PATH
                path.join(ROOT6, 'spam.exe'), // does not match regex
                path.join(ROOT6, 'py.exe'), // does not match regex
            ];
            const expected = executables.map(() => undefined);
            const locator = new WindowsKnownPathsLocator();
            setSearchPath([ROOT3, ROOT4, DOES_NOT_EXIST, ROOT5]);
            await locator.initialize();

            const envs = await Promise.all(
                executables.map((ex) => locator.resolveEnv(ex)),
            );

            assert.deepEqual(envs, expected);
        });
    });

    suite('no executables match', () => {
        test('iterEnvs()', async () => {
            const expected: PythonEnvInfo[] = [];
            const locator = new WindowsKnownPathsLocator();
            setSearchPath([ROOT6, DOES_NOT_EXIST]);
            await locator.initialize();
            // Once the locator has an FS watcher, we will need to stop it:
            //   cleanUps.push(() => locator.dispose());
            const query: PythonLocatorQuery | undefined = undefined;

            const iterator = locator.iterEnvs(query);
            const envs = await getEnvs(iterator);

            assert.deepEqual(envs, expected);
        });

        test('resolveEnv()', async () => {
            const executables = [
                path.join(ROOT2, 'python2.exe'),
                path.join(ROOT1, 'python3.8.exe'),
                path.join(ROOT1, 'python3.8.1rc1.10213.exe'), // does not match regex
                path.join(ROOT1, 'my-python.exe'), // does not match regex
                path.join(ROOT4, 'python2.exe'), // not executable
                path.join(ROOT5, 'subdir', 'python2.exe'), // non on $PATH
                path.join(ROOT6, 'spam.exe'), // does not match regex
                path.join(ROOT6, 'py.exe'), // does not match regex
            ];
            const expected = executables.map(() => undefined);
            const locator = new WindowsKnownPathsLocator();
            setSearchPath([ROOT6, DOES_NOT_EXIST]);
            await locator.initialize();

            const envs = await Promise.all(
                executables.map((ex) => locator.resolveEnv(ex)),
            );

            assert.deepEqual(envs, expected);
        });
    });

    suite('some executables match', () => {
        test('iterEnvs()', async () => {
            const expected: PythonEnvInfo[] = [
                // On Windows we do not assume 2.7 for "python.exe".
                getEnv('', '2.7', path.join(ROOT2, 'python2.exe')),
                getEnv('', '', path.join(ROOT1, 'python.exe')),
                getEnv('', '2.7', path.join(ROOT1, 'python2.7.exe')),
                getEnv('', '3.8', path.join(ROOT1, 'python3.8.exe')),
                getEnv('', '3', path.join(ROOT1, 'python3.exe')),
            ];
            const locator = new WindowsKnownPathsLocator();
            setSearchPath([ROOT2, ROOT6, ROOT1]);
            await locator.initialize();
            // Once the locator has an FS watcher, we will need to stop it:
            //   cleanUps.push(() => locator.dispose());
            const query: PythonLocatorQuery | undefined = undefined;

            const iterator = locator.iterEnvs(query);
            const envs = await getEnvs(iterator);
            envs.sort((v1, v2) => v1.executable.filename.localeCompare(v2.executable.filename));

            assert.deepEqual(envs, expected);
        });

        test('resolveEnv()', async () => {
            const expected: (PythonEnvInfo | undefined)[] = [
                getEnv('', '2.7', path.join(ROOT2, 'python2.exe')),
                undefined,
                undefined,
                getEnv('', '', path.join(ROOT1, 'python.exe')),
                getEnv('', '2.7', path.join(ROOT1, 'python2.7.exe')),
                getEnv('', '3.8', path.join(ROOT1, 'python3.8.exe')),
                undefined,
                undefined,
                undefined,
                undefined,
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
            ];
            const locator = new WindowsKnownPathsLocator();
            setSearchPath([ROOT2, ROOT6, ROOT1]);
            await locator.initialize();

            const envs = await Promise.all(
                executables.map((ex) => locator.resolveEnv(ex)),
            );

            assert.deepEqual(envs, expected);
        });
    });

    // Once the locator has an FS watcher, we will need to add
    // a test to verify that FS or env var changes cause the
    // locator to refresh and emit an event.  Until then there
    // really isn't much to test with `locator.onChanged`.
});
