// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import * as sinon from 'sinon';
import * as executablesAPI from '../../../../client/common/utils/exec';
import { PythonEnvKind } from '../../../../client/pythonEnvironments/base/info';
import { BasicEnvInfo } from '../../../../client/pythonEnvironments/base/locator';
import { getEnvs } from '../../../../client/pythonEnvironments/base/locatorUtils';
import { PosixKnownPathsLocator } from '../../../../client/pythonEnvironments/discovery/locators/services/posixKnownPathsLocator';
import { createBasicEnv } from '../../base/common';
import { TEST_LAYOUT_ROOT } from '../../common/commonTestConstants';
import { assertBasicEnvsEqual } from './envTestUtils';

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

        const expectedEnvs: BasicEnvInfo[] = [];
        testLocations.forEach((location) => {
            const binaries = testFileData.get(location);
            if (binaries) {
                binaries.forEach((binary) => {
                    expectedEnvs.push(createBasicEnv(PythonEnvKind.OtherGlobal, path.join(location, binary)));
                });
            }
        });

        const actualEnvs = (await getEnvs(locator.iterEnvs())).filter((e) => e.executablePath.indexOf('posixroot') > 0);
        assertBasicEnvsEqual(actualEnvs, expectedEnvs);
    });
});
