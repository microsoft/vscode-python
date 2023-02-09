// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { IApplicationEnvironment } from '../../../client/common/application/types';
import { IPersistentState } from '../../../client/common/types';
import { Common, ToolsExtensions } from '../../../client/common/utils/localize';
import * as commandApis from '../../../client/common/vscodeApis/commandApis';
import * as windowsApis from '../../../client/common/vscodeApis/windowApis';
import { IServiceContainer } from '../../../client/ioc/types';
import * as promptCommons from '../../../client/linters/prompts/common';
import { PylintExtensionPrompt, PYLINT_EXTENSION } from '../../../client/linters/prompts/pylintPrompt';
import { IToolsExtensionPrompt } from '../../../client/linters/prompts/types';

suite('Pylint Extension prompt tests', () => {
    let isExtensionEnabledStub: sinon.SinonStub;
    let isExtensionDisabledStub: sinon.SinonStub;
    let doNotShowPromptStateStub: sinon.SinonStub;
    let inToolsExtensionsExperimentStub: sinon.SinonStub;
    let showInformationMessageStub: sinon.SinonStub;
    let executeCommandStub: sinon.SinonStub;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let doNotState: TypeMoq.IMock<IPersistentState<boolean>>;
    let appEnv: TypeMoq.IMock<IApplicationEnvironment>;
    let prompt: IToolsExtensionPrompt;

    setup(() => {
        isExtensionEnabledStub = sinon.stub(promptCommons, 'isExtensionEnabled');
        isExtensionDisabledStub = sinon.stub(promptCommons, 'isExtensionDisabled');
        doNotShowPromptStateStub = sinon.stub(promptCommons, 'doNotShowPromptState');
        inToolsExtensionsExperimentStub = sinon.stub(promptCommons, 'inToolsExtensionsExperiment');
        showInformationMessageStub = sinon.stub(windowsApis, 'showInformationMessage');
        executeCommandStub = sinon.stub(commandApis, 'executeCommand');

        appEnv = TypeMoq.Mock.ofType<IApplicationEnvironment>();
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer
            .setup((s) => s.get<IApplicationEnvironment>(IApplicationEnvironment))
            .returns(() => appEnv.object);

        doNotState = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        prompt = new PylintExtensionPrompt(serviceContainer.object);
    });

    teardown(() => {
        sinon.restore();
    });

    test('Extension already installed and enabled', async () => {
        isExtensionEnabledStub.returns(true);

        assert.isTrue(await prompt.showPrompt());
    });

    test('Extension already installed, but disabled', async () => {
        isExtensionEnabledStub.returns(false);
        isExtensionDisabledStub.returns(true);

        assert.isTrue(await prompt.showPrompt());
    });

    test('User not in experiment', async () => {
        isExtensionEnabledStub.returns(false);
        isExtensionDisabledStub.returns(false);

        doNotState.setup((d) => d.value).returns(() => false);
        doNotShowPromptStateStub.returns(doNotState.object);
        inToolsExtensionsExperimentStub.resolves(false);

        assert.isFalse(await prompt.showPrompt());
    });

    test('User selected: install extension (insiders)', async () => {
        isExtensionEnabledStub.returns(false);
        isExtensionDisabledStub.returns(false);

        doNotState.setup((d) => d.value).returns(() => false);
        doNotShowPromptStateStub.returns(doNotState.object);
        inToolsExtensionsExperimentStub.resolves(true);

        appEnv.setup((a) => a.extensionChannel).returns(() => 'insiders');
        executeCommandStub.resolves(undefined);

        showInformationMessageStub.resolves(ToolsExtensions.installPylintExtension);
        assert.isTrue(await prompt.showPrompt());

        executeCommandStub.calledOnceWith('workbench.extensions.installExtension', PYLINT_EXTENSION, {
            installPreReleaseVersion: true,
        });
    });

    test('User selected: install extension (stable)', async () => {
        isExtensionEnabledStub.returns(false);
        isExtensionDisabledStub.returns(false);

        doNotState.setup((d) => d.value).returns(() => false);
        doNotShowPromptStateStub.returns(doNotState.object);
        inToolsExtensionsExperimentStub.resolves(true);

        appEnv.setup((a) => a.extensionChannel).returns(() => 'stable');
        executeCommandStub.resolves(undefined);

        showInformationMessageStub.resolves(ToolsExtensions.installPylintExtension);
        assert.isTrue(await prompt.showPrompt());

        executeCommandStub.calledOnceWith('workbench.extensions.installExtension', PYLINT_EXTENSION, {
            installPreReleaseVersion: false,
        });
    });

    test('User selected: do not show again', async () => {
        isExtensionEnabledStub.returns(false);
        isExtensionDisabledStub.returns(false);

        doNotState.setup((d) => d.value).returns(() => false);
        doNotShowPromptStateStub.returns(doNotState.object);
        inToolsExtensionsExperimentStub.resolves(true);

        doNotState
            .setup((d) => d.updateValue(true))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());
        showInformationMessageStub.resolves(Common.doNotShowAgain);
        assert.isFalse(await prompt.showPrompt());

        doNotState.verifyAll();
    });

    test('User selected: close', async () => {
        isExtensionEnabledStub.returns(false);
        isExtensionDisabledStub.returns(false);

        doNotState.setup((d) => d.value).returns(() => false);
        doNotShowPromptStateStub.returns(doNotState.object);
        inToolsExtensionsExperimentStub.resolves(true);

        showInformationMessageStub.resolves(undefined);
        assert.isFalse(await prompt.showPrompt());
    });
});
