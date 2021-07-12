// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as sinon from 'sinon';
import * as executablesAPI from '../../../../client/common/utils/exec';
import { Architecture } from '../../../../client/common/utils/platform';
import {
    PythonEnvInfo,
    PythonEnvKind,
    PythonEnvSource,
    PythonReleaseLevel,
    PythonVersion,
} from '../../../../client/pythonEnvironments/base/info';
import { buildEnvInfo } from '../../../../client/pythonEnvironments/base/info/env';
import { parseVersion } from '../../../../client/pythonEnvironments/base/info/pythonVersion';
import { getEnvs } from '../../../../client/pythonEnvironments/base/locatorUtils';
import { PosixKnownPathsLocator } from '../../../../client/pythonEnvironments/discovery/locators/services/posixKnownPathsLocator';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';
import { assertEnvsEqual } from './envTestUtils';

suite('Posix Known Path Locator', () => {
    let getPathEnvVar: sinon.SinonStub;
    let locator: PosixKnownPathsLocator;

    const testPosixKnownPathsRoot = path.join(TEST_LAYOUT_ROOT, 'posixroot');

    const testLocation1 = path.join(testPosixKnownPathsRoot, 'location1');
    const testLocation2 = path.join(testPosixKnownPathsRoot, 'location2');
    const testLocation3 = path.join(testPosixKnownPathsRoot, 'location3');

    const testFileData: Map<string, string[]> = new Map();

    testFileData.set(testLocation1, ['python', 'python3']);
    testFileData.set(testLocation2, ['python', 'python37', 'python38']);
    testFileData.set(testLocation3, ['python3.7', 'python3.8']);

    function createExpectedEnvInfo(executable: string, sysVersion?: string, versionStr?: string): PythonEnvInfo {
        let version: PythonVersion;
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
        return buildEnvInfo({
            version,
            kind: PythonEnvKind.OtherGlobal,
            arch: Architecture.Unknown,
            executable,
            source: [PythonEnvSource.PathEnvVar],
        });
    }

    setup(async () => {
        getPathEnvVar = sinon.stub(executablesAPI, 'getSearchPathEntries');
        locator = new PosixKnownPathsLocator();
    });
    teardown(() => {
        getPathEnvVar.restore();
    });

    test('iterEnvs(): get python bin from known test roots', async () => {
        const testLocations = [testLocation1, testLocation2, testLocation3];
        getPathEnvVar.returns(testLocations);

        const envs: PythonEnvInfo[] = [];
        testLocations.forEach((location) => {
            const binaries = testFileData.get(location);
            if (binaries) {
                binaries.forEach((binary) => {
                    envs.push(createExpectedEnvInfo(path.join(location, binary)));
                });
            }
        });
        const expectedEnvs = envs.sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));

        const actualEnvs = (await getEnvs(locator.iterEnvs()))
            .filter((e) => e.executable.filename.indexOf('posixroot') > 0)
            .sort((a, b) => a.executable.filename.localeCompare(b.executable.filename));
        assertEnvsEqual(actualEnvs, expectedEnvs);
    });
});
