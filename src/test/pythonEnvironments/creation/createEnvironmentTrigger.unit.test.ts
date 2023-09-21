// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { Uri } from 'vscode';
import * as triggerUtils from '../../../client/pythonEnvironments/creation/common/createEnvTriggerUtils';
import * as commonUtils from '../../../client/pythonEnvironments/creation/common/commonUtils';
import * as windowApis from '../../../client/common/vscodeApis/windowApis';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';
import {
    CreateEnvironmentCheckKind,
    triggerCreateEnvironmentCheckNonBlocking,
} from '../../../client/pythonEnvironments/creation/createEnvironmentTrigger';

suite('Create Environment Trigger', () => {
    let shouldPromptToCreateEnvStub: sinon.SinonStub;
    let hasVenvStub: sinon.SinonStub;
    let hasPrefixCondaEnvStub: sinon.SinonStub;
    let hasRequirementFilesStub: sinon.SinonStub;
    let hasKnownFilesStub: sinon.SinonStub;
    let isGlobalPythonSelectedStub: sinon.SinonStub;
    let showInformationMessageStub: sinon.SinonStub;

    const workspace1 = {
        uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace1')),
        name: 'workspace1',
        index: 0,
    };

    setup(() => {
        shouldPromptToCreateEnvStub = sinon.stub(triggerUtils, 'shouldPromptToCreateEnv');
        hasVenvStub = sinon.stub(commonUtils, 'hasVenv');
        hasPrefixCondaEnvStub = sinon.stub(commonUtils, 'hasPrefixCondaEnv');
        hasRequirementFilesStub = sinon.stub(triggerUtils, 'hasRequirementFiles');
        hasKnownFilesStub = sinon.stub(triggerUtils, 'hasKnownFiles');
        isGlobalPythonSelectedStub = sinon.stub(triggerUtils, 'isGlobalPythonSelected');
        showInformationMessageStub = sinon.stub(windowApis, 'showInformationMessage');
    });

    teardown(() => {
        sinon.restore();
    });

    test('No Uri', async () => {
        await triggerCreateEnvironmentCheckNonBlocking(CreateEnvironmentCheckKind.Workspace, undefined);
        sinon.assert.notCalled(shouldPromptToCreateEnvStub);
    });

    test('Should not perform checks if user set trigger to "off"', async () => {
        shouldPromptToCreateEnvStub.resolves(false);

        await triggerCreateEnvironmentCheckNonBlocking(CreateEnvironmentCheckKind.Workspace, workspace1.uri);

        sinon.assert.calledOnce(shouldPromptToCreateEnvStub);
        sinon.assert.notCalled(hasVenvStub);
        sinon.assert.notCalled(hasPrefixCondaEnvStub);
        sinon.assert.notCalled(hasRequirementFilesStub);
        sinon.assert.notCalled(hasKnownFilesStub);
        sinon.assert.notCalled(isGlobalPythonSelectedStub);
        sinon.assert.notCalled(showInformationMessageStub);
    });

    test('Should not perform checks even if force is true, if user set trigger to "off"', async () => {
        shouldPromptToCreateEnvStub.resolves(false);
        await triggerCreateEnvironmentCheckNonBlocking(CreateEnvironmentCheckKind.Workspace, workspace1.uri, {
            force: true,
        });

        sinon.assert.calledOnce(shouldPromptToCreateEnvStub);
        sinon.assert.notCalled(hasVenvStub);
        sinon.assert.notCalled(hasPrefixCondaEnvStub);
        sinon.assert.notCalled(hasRequirementFilesStub);
        sinon.assert.notCalled(hasKnownFilesStub);
        sinon.assert.notCalled(isGlobalPythonSelectedStub);
        sinon.assert.notCalled(showInformationMessageStub);
    });
});
