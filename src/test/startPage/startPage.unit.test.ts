// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as typemoq from 'typemoq';
import { ExtensionContext } from 'vscode';
import {
    IApplicationEnvironment,
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    IJupyterExtensionDependencyManager,
    IWebviewPanelProvider,
    IWorkspaceService,
} from '../../client/common/application/types';
import { PythonSettings } from '../../client/common/configSettings';
import { IFileSystem } from '../../client/common/platform/types';
import { StartPage } from '../../client/common/startPage/startPage';
import { ICodeCssGenerator, IStartPage, IThemeFinder, StartPageMessages } from '../../client/common/startPage/types';
import {
    IConfigurationService,
    IExtensionContext,
    IOutputChannel,
    IPersistentState,
    IPersistentStateFactory,
} from '../../client/common/types';
import { IJupyterNotInstalledNotificationHelper, JupyterNotInstalledOrigin } from '../../client/jupyter/types';
import { MockAutoSelectionService } from '../mocks/autoSelector';
import * as Telemetry from '../../client/telemetry';
import { EventName } from '../../client/telemetry/constants';
import { JupyterNotInstalledNotificationHelper } from '../../client/jupyter/jupyterNotInstalledNotificationHelper';
import { Jupyter } from '../../client/common/utils/localize';

suite('StartPage tests', () => {
    let startPage: IStartPage;
    let provider: typemoq.IMock<IWebviewPanelProvider>;
    let cssGenerator: typemoq.IMock<ICodeCssGenerator>;
    let themeFinder: typemoq.IMock<IThemeFinder>;
    let configuration: typemoq.IMock<IConfigurationService>;
    let workspaceService: typemoq.IMock<IWorkspaceService>;
    let file: typemoq.IMock<IFileSystem>;
    let commandManager: typemoq.IMock<ICommandManager>;
    let documentManager: typemoq.IMock<IDocumentManager>;
    let appShell: typemoq.IMock<IApplicationShell>;
    let context: typemoq.IMock<IExtensionContext>;
    let appEnvironment: typemoq.IMock<IApplicationEnvironment>;
    let depsManager: typemoq.IMock<IJupyterExtensionDependencyManager>;
    let outputChannel: typemoq.IMock<IOutputChannel>;
    let memento: typemoq.IMock<ExtensionContext['globalState']>;
    let notificationHelper: IJupyterNotInstalledNotificationHelper;
    const dummySettings = new PythonSettings(undefined, new MockAutoSelectionService());

    function setupVersions(savedVersion: string, actualVersion: string) {
        memento.setup((m) => m.get(typemoq.It.isAnyString())).returns(() => savedVersion);
        memento
            .setup((m) => m.update(typemoq.It.isAnyString(), typemoq.It.isAnyString()))
            .returns(() => Promise.resolve());
        const packageJson = {
            version: actualVersion,
        };
        appEnvironment.setup((ae) => ae.packageJson).returns(() => packageJson);
    }

    function reset() {
        memento.reset();
        appEnvironment.reset();
    }

    setup(async () => {
        provider = typemoq.Mock.ofType<IWebviewPanelProvider>();
        cssGenerator = typemoq.Mock.ofType<ICodeCssGenerator>();
        themeFinder = typemoq.Mock.ofType<IThemeFinder>();
        configuration = typemoq.Mock.ofType<IConfigurationService>();
        workspaceService = typemoq.Mock.ofType<IWorkspaceService>();
        file = typemoq.Mock.ofType<IFileSystem>();
        commandManager = typemoq.Mock.ofType<ICommandManager>();
        documentManager = typemoq.Mock.ofType<IDocumentManager>();
        appShell = typemoq.Mock.ofType<IApplicationShell>();
        context = typemoq.Mock.ofType<IExtensionContext>();
        appEnvironment = typemoq.Mock.ofType<IApplicationEnvironment>();
        depsManager = typemoq.Mock.ofType<IJupyterExtensionDependencyManager>();
        outputChannel = typemoq.Mock.ofType<IOutputChannel>();
        memento = typemoq.Mock.ofType<ExtensionContext['globalState']>();

        // Notification helper object
        const stateFactory = typemoq.Mock.ofType<IPersistentStateFactory>();
        const state = typemoq.Mock.ofType<IPersistentState<string>>();

        stateFactory
            .setup((s) => s.createGlobalPersistentState(typemoq.It.isAny(), typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => state.object);
        notificationHelper = new JupyterNotInstalledNotificationHelper(
            appShell.object,
            stateFactory.object,
            depsManager.object,
        );

        context.setup((c) => c.globalState).returns(() => memento.object);
        configuration.setup((cs) => cs.getSettings(undefined)).returns(() => dummySettings);

        startPage = new StartPage(
            provider.object,
            cssGenerator.object,
            themeFinder.object,
            configuration.object,
            workspaceService.object,
            file.object,
            commandManager.object,
            documentManager.object,
            appShell.object,
            context.object,
            appEnvironment.object,
            notificationHelper,
            depsManager.object,
            outputChannel.object,
        );
    });

    teardown(() => {
        sinon.restore();
    });

    test('Check extension version', async () => {
        let savedVersion: string;
        let actualVersion: string;

        // Version has not changed
        savedVersion = '2020.6.0-dev';
        actualVersion = '2020.6.0-dev';
        setupVersions(savedVersion, actualVersion);

        const test1 = await startPage.extensionVersionChanged();
        assert.equal(test1, false, 'The version is the same, start page should not open.');
        reset();

        // actual version is older
        savedVersion = '2020.6.0-dev';
        actualVersion = '2020.5.0-dev';
        setupVersions(savedVersion, actualVersion);

        const test2 = await startPage.extensionVersionChanged();
        assert.equal(test2, false, 'The actual version is older, start page should not open.');
        reset();

        // actual version is newer
        savedVersion = '2020.6.0-dev';
        actualVersion = '2020.6.1';
        setupVersions(savedVersion, actualVersion);

        const test3 = await startPage.extensionVersionChanged();
        assert.equal(test3, true, 'The actual version is newer, start page should open.');
        reset();
    });

    suite('"Jupyter is not installed" prompt tests', () => {
        type StartPageMessageForTests = IStartPage & {
            onMessage(message: string, payload: unknown): Promise<void>;
        };

        let startPageWithMessageHandler: StartPageMessageForTests;
        let telemetryEvents: { eventName: string; properties: Record<string, unknown> }[] = [];
        let sendTelemetryEventStub: sinon.SinonStub;

        setup(() => {
            sendTelemetryEventStub = sinon
                .stub(Telemetry, 'sendTelemetryEvent')
                .callsFake((eventName: string, _, properties: Record<string, unknown>) => {
                    const telemetry = { eventName, properties };
                    telemetryEvents.push(telemetry);
                });

            startPageWithMessageHandler = (startPage as unknown) as StartPageMessageForTests;
        });

        teardown(() => {
            telemetryEvents = [];
            Telemetry._resetSharedProperties();
        });

        const notebookActions = [
            {
                testcase: 'a blank notebook',
                message: StartPageMessages.OpenBlankNotebook,
                entrypoint: JupyterNotInstalledOrigin.StartPageOpenBlankNotebook,
            },
            {
                testcase: 'a sample notebook',
                message: StartPageMessages.OpenSampleNotebook,
                entrypoint: JupyterNotInstalledOrigin.StartPageOpenSampleNotebook,
            },
            {
                testcase: 'the interactive window',
                message: StartPageMessages.OpenInteractiveWindow,
                entrypoint: JupyterNotInstalledOrigin.StartPageOpenInteractiveWindow,
            },
        ];

        notebookActions.forEach(({ testcase, message, entrypoint }) => {
            suite(`When opening ${testcase}`, () => {
                test('Should display "Jupyter is not installed" prompt if the Jupyter extension is not installed and the prompt should not be shown', async () => {
                    depsManager.setup((dm) => dm.isJupyterExtensionInstalled).returns(() => false);
                    const shouldShowPromptStub = sinon.stub(
                        notificationHelper,
                        'shouldShowJupypterExtensionNotInstalledPrompt',
                    );
                    shouldShowPromptStub.returns(true);

                    await startPageWithMessageHandler.onMessage(message, {});

                    sinon.assert.called(sendTelemetryEventStub);
                    sinon.assert.calledOnce(shouldShowPromptStub);
                    // 2 events: one when the prompt is displayed, one with the prompt selection (in this case, nothing).
                    assert.strictEqual(telemetryEvents.length, 2);
                    assert.deepStrictEqual(telemetryEvents[0], {
                        eventName: EventName.JUPYTER_NOT_INSTALLED_NOTIFICATION_DISPLAYED,
                        properties: { entrypoint },
                    });
                });

                test('Should not display "Jupyter is not installed" prompt if the Jupyter extension is not installed and the prompt should not be shown', async () => {
                    depsManager.setup((dm) => dm.isJupyterExtensionInstalled).returns(() => false);
                    const shouldShowPromptStub = sinon.stub(
                        notificationHelper,
                        'shouldShowJupypterExtensionNotInstalledPrompt',
                    );
                    shouldShowPromptStub.returns(false);

                    await startPageWithMessageHandler.onMessage(StartPageMessages.OpenBlankNotebook, {});

                    sinon.assert.notCalled(sendTelemetryEventStub);
                    sinon.assert.calledOnce(shouldShowPromptStub);
                    assert.strictEqual(telemetryEvents.length, 0);
                });

                test('Should not display "Jupyter is not installed" prompt if the Jupyter extension is installed', async () => {
                    depsManager.setup((dm) => dm.isJupyterExtensionInstalled).returns(() => true);
                    const shouldShowPromptStub = sinon.stub(
                        notificationHelper,
                        'shouldShowJupypterExtensionNotInstalledPrompt',
                    );
                    shouldShowPromptStub.returns(false);

                    await startPageWithMessageHandler.onMessage(StartPageMessages.OpenBlankNotebook, {});

                    sinon.assert.called(sendTelemetryEventStub);
                    sinon.assert.calledOnce(shouldShowPromptStub);
                    // There is a telemetry event sent when performing the action.
                    assert.strictEqual(telemetryEvents.length, 1);
                    assert.notDeepStrictEqual(telemetryEvents[0], {
                        eventName: EventName.JUPYTER_NOT_INSTALLED_NOTIFICATION_DISPLAYED,
                        properties: { entrypoint },
                    });
                });

                test('Should write something in the Python output channel if the Jupyter extension is not installed', async () => {
                    let output = '';
                    outputChannel
                        .setup((oc) => oc.appendLine(typemoq.It.isAnyString()))
                        .callback((line: string) => {
                            output += line;
                        })
                        .verifiable(typemoq.Times.once());
                    depsManager.setup((dm) => dm.isJupyterExtensionInstalled).returns(() => false);

                    await startPageWithMessageHandler.onMessage(StartPageMessages.OpenBlankNotebook, {});

                    outputChannel.verify(
                        (oc) => oc.appendLine(Jupyter.jupyterExtensionNotInstalled()),
                        typemoq.Times.once(),
                    );
                    assert.strictEqual(output, Jupyter.jupyterExtensionNotInstalled());
                });
            });
        });
    });
});
