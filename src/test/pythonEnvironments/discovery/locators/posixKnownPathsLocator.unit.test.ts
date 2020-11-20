// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as sinon from 'sinon';
import * as executablesAPI from '../../../../client/common/utils/exec';
import { Architecture } from '../../../../client/common/utils/platform';
import {
    PythonEnvInfo, PythonEnvKind, PythonReleaseLevel, PythonVersion,
} from '../../../../client/pythonEnvironments/base/info';
import { InterpreterInformation } from '../../../../client/pythonEnvironments/base/info/interpreter';
import { parseVersion } from '../../../../client/pythonEnvironments/base/info/pythonVersion';
import { IDisposableLocator } from '../../../../client/pythonEnvironments/base/locator';
import { getEnvs } from '../../../../client/pythonEnvironments/base/locatorUtils';
import { createPosixKnownPathsLocator } from '../../../../client/pythonEnvironments/discovery/locators/services/posixKnownPathsLocator';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';
import { assertEnvEqual, assertEnvsEqual } from './envTestUtils';

suite('Posix Known Path Locator', () => {
    let getPathEnvVar: sinon.SinonStub;
    let locator: IDisposableLocator;

    const testPosixKnownPathsRoot = path.join(TEST_LAYOUT_ROOT, 'posixroot');

    const testLocation1 = path.join(testPosixKnownPathsRoot, 'location1');
    const testLocation2 = path.join(testPosixKnownPathsRoot, 'location2');
    const testLocation3 = path.join(testPosixKnownPathsRoot, 'location3');

    const testFileData:Map<string, string[]> = new Map();

    testFileData.set(testLocation1, ['python', 'python3']);
    testFileData.set(testLocation2, ['python', 'python37', 'python38']);
    testFileData.set(testLocation3, ['python3.7', 'python3.8']);

    function createExpectedInterpreterInfo(
        executable: string,
        sysVersion?: string,
        sysPrefix?: string,
        versionStr?:string,
    ): InterpreterInformation {
        let version:PythonVersion;
        try {
            version = parseVersion(versionStr ?? path.basename(executable));
            if (sysVersion) {
                version.sysVersion = sysVersion;
            }
        } catch (e) {
            version = {
                major: -1,
                minor: -1,
                micro: -1,
                release: { level: PythonReleaseLevel.Final, serial: -1 },
                sysVersion,
            };
        }
        return {
            version,
            arch: Architecture.Unknown,
            executable: {
                filename: executable,
                sysPrefix: sysPrefix ?? '',
                ctime: -1,
                mtime: -1,
            },
        };
    }

    setup(async () => {
        getPathEnvVar = sinon.stub(executablesAPI, 'getSearchPathEntries');
        locator = await createPosixKnownPathsLocator();
    });
    teardown(() => {
        getPathEnvVar.restore();
        locator.dispose();
    });

    test('iterEnvs(): get python bin from known test roots', async () => {
        const testLocations = [testLocation1, testLocation2, testLocation3];
        getPathEnvVar.returns(testLocations);

        const envs:PythonEnvInfo[] = [];
        testLocations.forEach((location) => {
            const binaries = testFileData.get(location);
            if (binaries) {
                binaries.forEach((binary) => {
                    envs.push({
                        name: '',
                        location: '',
                        kind: PythonEnvKind.OtherGlobal,
                        distro: { org: '' },
                        ...createExpectedInterpreterInfo(path.join(location, binary)),
                    });
                });
            }
        });
        const expectedEnvs = envs.sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));

        const actualEnvs = (await getEnvs(locator.iterEnvs()))
            .filter((e) => e.executable.filename.indexOf('posixroot') > 0)
            .sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));
        assertEnvsEqual(actualEnvs, expectedEnvs);
    });

    test('resolveEnv(string)', async () => {
        const pythonPath = path.join(testLocation1, 'python');
        const expected = {
            name: '',
            location: '',
            kind: PythonEnvKind.OtherGlobal,
            distro: { org: '' },
            ...createExpectedInterpreterInfo(pythonPath),
        };

        const actual = await locator.resolveEnv(pythonPath);
        assertEnvEqual(actual, expected);
    });

    test('resolveEnv(PythonEnvInfo)', async () => {
        const pythonPath = path.join(testLocation1, 'python');
        const expected = {

            name: '',
            location: '',
            kind: PythonEnvKind.OtherGlobal,
            distro: { org: '' },
            ...createExpectedInterpreterInfo(pythonPath),
        };

        // Partially filled in env info object
        const input:PythonEnvInfo = {
            name: '',
            location: '',
            kind: PythonEnvKind.Unknown,
            distro: { org: '' },
            arch: Architecture.Unknown,
            executable: {
                filename: pythonPath,
                sysPrefix: '',
                ctime: -1,
                mtime: -1,
            },
            version: {
                major: -1,
                minor: -1,
                micro: -1,
                release: { level: PythonReleaseLevel.Final, serial: -1 },
            },
        };

        const actual = await locator.resolveEnv(input);

        assertEnvEqual(actual, expected);
    });
});
