// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as platformApis from '../../../../client/common/utils/platform';
import {
    PythonEnvInfo, PythonEnvKind, PythonReleaseLevel, PythonVersion,
} from '../../../../client/pythonEnvironments/base/info';
import { InterpreterInformation } from '../../../../client/pythonEnvironments/base/info/interpreter';
import { parseVersion } from '../../../../client/pythonEnvironments/base/info/pythonVersion';
import { getEnvs } from '../../../../client/pythonEnvironments/base/locatorUtils';
import { PosixKnownPathsLocator } from '../../../../client/pythonEnvironments/discovery/locators/services/posixKnownPathsLocator';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';

suite('Posix Known Path Locator', () => {
    let getEnvVar: sinon.SinonStub;
    const testPosixKnownPathsRoot = path.join(TEST_LAYOUT_ROOT, 'posixroot');

    const testLocation1 = path.join(testPosixKnownPathsRoot, 'location1');
    const testLocation2 = path.join(testPosixKnownPathsRoot, 'location2');
    const testLocation3 = path.join(testPosixKnownPathsRoot, 'location3');
    const testLocation4 = path.join(testPosixKnownPathsRoot, 'location3', 'location4');

    const testFileData:Map<string, string[]> = new Map();

    testFileData.set(testLocation1, ['python', 'python3']);
    testFileData.set(testLocation2, ['python', 'python37', 'python38']);
    testFileData.set(testLocation3, ['python3.7', 'python3.8']);
    testFileData.set(testLocation4, ['python']);

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
            arch: platformApis.Architecture.Unknown,
            executable: {
                filename: executable,
                sysPrefix: sysPrefix ?? '',
                ctime: -1,
                mtime: -1,
            },
        };
    }

    setup(() => {
        getEnvVar = sinon.stub(platformApis, 'getEnvironmentVariable');
    });
    teardown(() => {
        getEnvVar.restore();
    });
    test('iterEnvs(): get python bin from known test roots', async () => {
        const testLocations = [testLocation1, testLocation2, testLocation3];
        getEnvVar.withArgs('PATH', testLocations.join(path.posix.delimiter));

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

        const locator = new PosixKnownPathsLocator();
        const actualEnvs = (await getEnvs(locator.iterEnvs()))
            .filter((e) => e.executable.filename.indexOf('posixroot') > 0);
    });
});
