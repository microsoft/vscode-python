// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { WorkspaceConfiguration } from 'vscode';
import { IPersistentState } from '../../../client/common/types';
import * as workspaceApis from '../../../client/common/vscodeApis/workspaceApis';
import * as windowApis from '../../../client/common/vscodeApis/windowApis';
import * as extensionsApi from '../../../client/common/vscodeApis/extensionsApi';
import { IServiceContainer } from '../../../client/ioc/types';
import { InstallFormatterPrompt } from '../../../client/providers/prompts/installFormatterPrompt';
import * as promptUtils from '../../../client/providers/prompts/promptUtils';
import { AUTOPEP8_EXTENSION, BLACK_EXTENSION, IInstallFormatterPrompt } from '../../../client/providers/prompts/types';
import { Common, ToolsExtensions } from '../../../client/common/utils/localize';

suite('Formatter Extension prompt tests', () => {
    let inFormatterExtensionExperimentStub: sinon.SinonStub;
    let doNotShowPromptStateStub: sinon.SinonStub;
    let prompt: IInstallFormatterPrompt;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let persistState: TypeMoq.IMock<IPersistentState<boolean>>;
    let getConfigurationStub: sinon.SinonStub;
    let isExtensionEnabledStub: sinon.SinonStub;
    let pythonConfig: TypeMoq.IMock<WorkspaceConfiguration>;
    let editorConfig: TypeMoq.IMock<WorkspaceConfiguration>;
    let showInformationMessageStub: sinon.SinonStub;
    let installFormatterExtensionStub: sinon.SinonStub;
    let updateDefaultFormatterStub: sinon.SinonStub;

    setup(() => {
        inFormatterExtensionExperimentStub = sinon.stub(promptUtils, 'inFormatterExtensionExperiment');
        inFormatterExtensionExperimentStub.returns(true);

        doNotShowPromptStateStub = sinon.stub(promptUtils, 'doNotShowPromptState');
        persistState = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        doNotShowPromptStateStub.returns(persistState.object);

        getConfigurationStub = sinon.stub(workspaceApis, 'getConfiguration');
        pythonConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        editorConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        getConfigurationStub.callsFake((section: string) => {
            if (section === 'python') {
                return pythonConfig.object;
            }
            return editorConfig.object;
        });
        isExtensionEnabledStub = sinon.stub(extensionsApi, 'isExtensionEnabled');
        showInformationMessageStub = sinon.stub(windowApis, 'showInformationMessage');
        installFormatterExtensionStub = sinon.stub(promptUtils, 'installFormatterExtension');
        updateDefaultFormatterStub = sinon.stub(promptUtils, 'updateDefaultFormatter');

        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();

        prompt = new InstallFormatterPrompt(serviceContainer.object);
    });

    teardown(() => {
        sinon.restore();
    });

    test('Not in experiment', async () => {
        inFormatterExtensionExperimentStub.returns(false);

        await prompt.showInstallFormatterPrompt();
        assert.isTrue(doNotShowPromptStateStub.notCalled);
    });

    test('Do not show was set', async () => {
        persistState.setup((p) => p.value).returns(() => true);

        await prompt.showInstallFormatterPrompt();
        assert.isTrue(getConfigurationStub.notCalled);
    });

    test('Formatting provider is set to none', async () => {
        persistState.setup((p) => p.value).returns(() => false);
        pythonConfig.setup((p) => p.get('formatting.provider', TypeMoq.It.isAny())).returns(() => 'none');

        await prompt.showInstallFormatterPrompt();
        assert.isTrue(isExtensionEnabledStub.notCalled);
    });

    test('Formatting provider is set to yapf', async () => {
        persistState.setup((p) => p.value).returns(() => false);
        pythonConfig.setup((p) => p.get('formatting.provider', TypeMoq.It.isAny())).returns(() => 'yapf');

        await prompt.showInstallFormatterPrompt();
        assert.isTrue(isExtensionEnabledStub.notCalled);
    });

    test('Formatting provider is set to autopep8, and autopep8 extension is set as default formatter', async () => {
        persistState.setup((p) => p.value).returns(() => false);
        pythonConfig.setup((p) => p.get('formatting.provider', TypeMoq.It.isAny())).returns(() => 'autopep8');
        editorConfig.setup((p) => p.get('defaultFormatter', TypeMoq.It.isAny())).returns(() => AUTOPEP8_EXTENSION);

        await prompt.showInstallFormatterPrompt();
        assert.isTrue(isExtensionEnabledStub.notCalled);
    });

    test('Formatting provider is set to black, and black extension is set as default formatter', async () => {
        persistState.setup((p) => p.value).returns(() => false);
        pythonConfig.setup((p) => p.get('formatting.provider', TypeMoq.It.isAny())).returns(() => 'black');
        editorConfig.setup((p) => p.get('defaultFormatter', TypeMoq.It.isAny())).returns(() => BLACK_EXTENSION);

        await prompt.showInstallFormatterPrompt();
        assert.isTrue(isExtensionEnabledStub.notCalled);
    });

    test('Prompt: user selects do not show', async () => {
        persistState.setup((p) => p.value).returns(() => false);
        persistState
            .setup((p) => p.updateValue(true))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.atLeastOnce());
        pythonConfig.setup((p) => p.get('formatting.provider', TypeMoq.It.isAny())).returns(() => 'autopep8');
        editorConfig.setup((p) => p.get('defaultFormatter', TypeMoq.It.isAny())).returns(() => '');
        isExtensionEnabledStub.returns(undefined);

        showInformationMessageStub.resolves(Common.doNotShowAgain);

        await prompt.showInstallFormatterPrompt();
        assert.isTrue(
            showInformationMessageStub.calledWith(
                ToolsExtensions.installAutopep8FormatterPrompt,
                'Black',
                'Autopep8',
                Common.doNotShowAgain,
            ),
            'showInformationMessage should be called',
        );
        persistState.verifyAll();
    });

    test('Prompt (autopep8): user selects Autopep8', async () => {
        persistState.setup((p) => p.value).returns(() => false);
        pythonConfig.setup((p) => p.get('formatting.provider', TypeMoq.It.isAny())).returns(() => 'autopep8');
        editorConfig.setup((p) => p.get('defaultFormatter', TypeMoq.It.isAny())).returns(() => '');
        isExtensionEnabledStub.returns(undefined);

        showInformationMessageStub.resolves('Autopep8');

        await prompt.showInstallFormatterPrompt();
        assert.isTrue(
            showInformationMessageStub.calledWith(
                ToolsExtensions.installAutopep8FormatterPrompt,
                'Black',
                'Autopep8',
                Common.doNotShowAgain,
            ),
            'showInformationMessage should be called',
        );
        assert.isTrue(
            installFormatterExtensionStub.calledWith(AUTOPEP8_EXTENSION, undefined),
            'installFormatterExtension should be called',
        );
    });

    test('Prompt (autopep8): user selects Black', async () => {
        persistState.setup((p) => p.value).returns(() => false);
        pythonConfig.setup((p) => p.get('formatting.provider', TypeMoq.It.isAny())).returns(() => 'autopep8');
        editorConfig.setup((p) => p.get('defaultFormatter', TypeMoq.It.isAny())).returns(() => '');
        isExtensionEnabledStub.returns(undefined);

        showInformationMessageStub.resolves('Black');

        await prompt.showInstallFormatterPrompt();
        assert.isTrue(
            showInformationMessageStub.calledWith(
                ToolsExtensions.installAutopep8FormatterPrompt,
                'Black',
                'Autopep8',
                Common.doNotShowAgain,
            ),
            'showInformationMessage should be called',
        );
        assert.isTrue(
            installFormatterExtensionStub.calledWith(BLACK_EXTENSION, undefined),
            'installFormatterExtension should be called',
        );
    });

    test('Prompt (black): user selects Autopep8', async () => {
        persistState.setup((p) => p.value).returns(() => false);
        pythonConfig.setup((p) => p.get('formatting.provider', TypeMoq.It.isAny())).returns(() => 'black');
        editorConfig.setup((p) => p.get('defaultFormatter', TypeMoq.It.isAny())).returns(() => '');
        isExtensionEnabledStub.returns(undefined);

        showInformationMessageStub.resolves('Autopep8');

        await prompt.showInstallFormatterPrompt();
        assert.isTrue(
            showInformationMessageStub.calledWith(
                ToolsExtensions.installBlackFormatterPrompt,
                'Black',
                'Autopep8',
                Common.doNotShowAgain,
            ),
            'showInformationMessage should be called',
        );
        assert.isTrue(
            installFormatterExtensionStub.calledWith(AUTOPEP8_EXTENSION, undefined),
            'installFormatterExtension should be called',
        );
    });

    test('Prompt (black): user selects Black', async () => {
        persistState.setup((p) => p.value).returns(() => false);
        pythonConfig.setup((p) => p.get('formatting.provider', TypeMoq.It.isAny())).returns(() => 'black');
        editorConfig.setup((p) => p.get('defaultFormatter', TypeMoq.It.isAny())).returns(() => '');
        isExtensionEnabledStub.returns(undefined);

        showInformationMessageStub.resolves('Black');

        await prompt.showInstallFormatterPrompt();
        assert.isTrue(
            showInformationMessageStub.calledWith(
                ToolsExtensions.installBlackFormatterPrompt,
                'Black',
                'Autopep8',
                Common.doNotShowAgain,
            ),
            'showInformationMessage should be called',
        );
        assert.isTrue(
            installFormatterExtensionStub.calledWith(BLACK_EXTENSION, undefined),
            'installFormatterExtension should be called',
        );
    });

    test('Prompt: Black and Autopep8 installed user selects Black as default', async () => {
        persistState.setup((p) => p.value).returns(() => false);
        pythonConfig.setup((p) => p.get('formatting.provider', TypeMoq.It.isAny())).returns(() => 'black');
        editorConfig.setup((p) => p.get('defaultFormatter', TypeMoq.It.isAny())).returns(() => '');
        isExtensionEnabledStub.returns({});

        showInformationMessageStub.resolves('Black');

        await prompt.showInstallFormatterPrompt();
        assert.isTrue(
            showInformationMessageStub.calledWith(
                ToolsExtensions.selectMultipleFormattersPrompt,
                'Black',
                'Autopep8',
                Common.doNotShowAgain,
            ),
            'showInformationMessage should be called',
        );
        assert.isTrue(
            updateDefaultFormatterStub.calledWith(BLACK_EXTENSION, undefined),
            'updateDefaultFormatter should be called',
        );
    });

    test('Prompt: Black and Autopep8 installed user selects Autopep8 as default', async () => {
        persistState.setup((p) => p.value).returns(() => false);
        pythonConfig.setup((p) => p.get('formatting.provider', TypeMoq.It.isAny())).returns(() => 'autopep8');
        editorConfig.setup((p) => p.get('defaultFormatter', TypeMoq.It.isAny())).returns(() => '');
        isExtensionEnabledStub.returns({});

        showInformationMessageStub.resolves('Autopep8');

        await prompt.showInstallFormatterPrompt();
        assert.isTrue(
            showInformationMessageStub.calledWith(
                ToolsExtensions.selectMultipleFormattersPrompt,
                'Black',
                'Autopep8',
                Common.doNotShowAgain,
            ),
            'showInformationMessage should be called',
        );
        assert.isTrue(
            updateDefaultFormatterStub.calledWith(AUTOPEP8_EXTENSION, undefined),
            'updateDefaultFormatter should be called',
        );
    });

    test('Prompt: Black installed user selects Black as default', async () => {
        persistState.setup((p) => p.value).returns(() => false);
        pythonConfig.setup((p) => p.get('formatting.provider', TypeMoq.It.isAny())).returns(() => 'black');
        editorConfig.setup((p) => p.get('defaultFormatter', TypeMoq.It.isAny())).returns(() => '');
        isExtensionEnabledStub.callsFake((extensionId) => {
            if (extensionId === BLACK_EXTENSION) {
                return {};
            }
            return undefined;
        });

        showInformationMessageStub.resolves('Black');

        await prompt.showInstallFormatterPrompt();
        assert.isTrue(
            showInformationMessageStub.calledWith(
                ToolsExtensions.selectBlackFormatterPrompt,
                Common.bannerLabelYes,
                Common.doNotShowAgain,
            ),
            'showInformationMessage should be called',
        );
        assert.isTrue(
            updateDefaultFormatterStub.calledWith(BLACK_EXTENSION, undefined),
            'updateDefaultFormatter should be called',
        );
    });

    test('Prompt: Autopep8 installed user selects Autopep8 as default', async () => {
        persistState.setup((p) => p.value).returns(() => false);
        pythonConfig.setup((p) => p.get('formatting.provider', TypeMoq.It.isAny())).returns(() => 'autopep8');
        editorConfig.setup((p) => p.get('defaultFormatter', TypeMoq.It.isAny())).returns(() => '');
        isExtensionEnabledStub.callsFake((extensionId) => {
            if (extensionId === AUTOPEP8_EXTENSION) {
                return {};
            }
            return undefined;
        });

        showInformationMessageStub.resolves('Autopep8');

        await prompt.showInstallFormatterPrompt();
        assert.isTrue(
            showInformationMessageStub.calledWith(
                ToolsExtensions.selectAutopep8FormatterPrompt,
                Common.bannerLabelYes,
                Common.doNotShowAgain,
            ),
            'showInformationMessage should be called',
        );
        assert.isTrue(
            updateDefaultFormatterStub.calledWith(AUTOPEP8_EXTENSION, undefined),
            'updateDefaultFormatter should be called',
        );
    });
});
