// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as sinon from 'sinon';
import * as path from 'path';
import { PythonEnvKind } from '../../../../../client/pythonEnvironments/base/info';
import * as externalDependencies from '../../../../../client/pythonEnvironments/common/externalDependencies';
import * as platformUtils from '../../../../../client/common/utils/platform';
import { getEnvs } from '../../../../../client/pythonEnvironments/base/locatorUtils';
import { HatchLocator } from '../../../../../client/pythonEnvironments/base/locators/lowLevel/hatchLocator';
import { assertBasicEnvsEqual } from '../envTestUtils';
import { createBasicEnv } from '../../common';
import { makeExecHandler, projectDirs, venvDirs } from '../../../common/environmentManagers/hatch.unit.test';

suite('Hatch Locator', () => {
    let exec: sinon.SinonStub;
    let getPythonSetting: sinon.SinonStub;
    let getOSType: sinon.SinonStub;
    let locator: HatchLocator;

    suiteSetup(() => {
        getPythonSetting = sinon.stub(externalDependencies, 'getPythonSetting');
        getPythonSetting.returns('hatch');
        getOSType = sinon.stub(platformUtils, 'getOSType');
        exec = sinon.stub(externalDependencies, 'exec');
    });

    suiteTeardown(() => sinon.restore());

    suite('Non-Windows', () => {
        setup(() => {
            locator = new HatchLocator(projectDirs.project1);
            getOSType.returns(platformUtils.OSType.Linux);
            exec.callsFake(
                makeExecHandler(venvDirs.project1.default, { hatchPath: 'hatch', cwd: projectDirs.project1 }),
            );
        });

        test('iterEnvs()', async () => {
            // Act
            const iterator = locator.iterEnvs();
            const actualEnvs = await getEnvs(iterator);

            // Assert
            const expectedEnvs = [
                createBasicEnv(PythonEnvKind.Hatch, path.join(venvDirs.project1.default, 'bin/python')),
            ];
            assertBasicEnvsEqual(actualEnvs, expectedEnvs);
        });
    });
});
