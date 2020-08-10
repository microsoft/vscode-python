// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { assert } from 'chai';
import * as sinon from 'sinon';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { ConfigurationChangeEvent, ConfigurationTarget, EventEmitter } from 'vscode';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { IApplicationShell, IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { HttpClient } from '../../../client/common/net/httpClient';
import { PersistentState, PersistentStateFactory } from '../../../client/common/persistentState';
import { IConfigurationService, IPythonSettings } from '../../../client/common/types';
import { Common, DataScience } from '../../../client/common/utils/localize';
import { noop } from '../../../client/common/utils/misc';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';
import { DataScienceFileSystem } from '../../../client/datascience/dataScienceFileSystem';
import { CDNWidgetScriptSourceProvider } from '../../../client/datascience/ipywidgets/cdnWidgetScriptSourceProvider';
import { IPyWidgetScriptSourceProvider } from '../../../client/datascience/ipywidgets/ipyWidgetScriptSourceProvider';
import { LocalWidgetScriptSourceProvider } from '../../../client/datascience/ipywidgets/localWidgetScriptSourceProvider';
import { RemoteWidgetScriptSourceProvider } from '../../../client/datascience/ipywidgets/remoteWidgetScriptSourceProvider';
import { JupyterNotebookBase } from '../../../client/datascience/jupyter/jupyterNotebook';
import { IJupyterConnection, ILocalResourceUriConverter, INotebook } from '../../../client/datascience/types';
import { InterpreterService } from '../../../client/interpreter/interpreterService';

// tslint:disable: no-any no-invalid-this

suite('DataScience - ipywidget - Widget Script Source Provider', () => {
    let scriptSourceProvider: IPyWidgetScriptSourceProvider;
    let notebook: INotebook;
    let configService: IConfigurationService;
    let settings: IPythonSettings;
    let appShell: IApplicationShell;
    let workspaceService: IWorkspaceService;
    let onDidChangeWorkspaceSettings: EventEmitter<ConfigurationChangeEvent>;
    let userSelectedOkOrDoNotShowAgainInPrompt: PersistentState<boolean>;
    setup(() => {
        notebook = mock(JupyterNotebookBase);
        configService = mock(ConfigurationService);
        appShell = mock(ApplicationShell);
        workspaceService = mock(WorkspaceService);
        onDidChangeWorkspaceSettings = new EventEmitter<ConfigurationChangeEvent>();
        when(workspaceService.onDidChangeConfiguration).thenReturn(onDidChangeWorkspaceSettings.event);
        const httpClient = mock(HttpClient);
        const resourceConverter = mock<ILocalResourceUriConverter>();
        const fs = mock(DataScienceFileSystem);
        const interpreterService = mock(InterpreterService);
        const stateFactory = mock(PersistentStateFactory);
        userSelectedOkOrDoNotShowAgainInPrompt = mock<PersistentState<boolean>>();

        when(stateFactory.createGlobalPersistentState(anything(), anything())).thenReturn(
            instance(userSelectedOkOrDoNotShowAgainInPrompt)
        );
        settings = { datascience: { widgetScriptSources: [] } } as any;
        when(configService.getSettings(anything())).thenReturn(settings as any);
        when(userSelectedOkOrDoNotShowAgainInPrompt.value).thenReturn(false);
        when(userSelectedOkOrDoNotShowAgainInPrompt.updateValue(anything())).thenResolve();
        scriptSourceProvider = new IPyWidgetScriptSourceProvider(
            instance(notebook),
            instance(resourceConverter),
            instance(fs),
            instance(interpreterService),
            instance(appShell),
            instance(configService),
            instance(workspaceService),
            instance(stateFactory),
            instance(httpClient)
        );
    });
    teardown(() => sinon.restore());

    [true, false].forEach((localLaunch) => {
        suite(localLaunch ? 'Local Jupyter Server' : 'Remote Jupyter Server', () => {
            setup(() => {
                const connection: IJupyterConnection = {
                    type: 'jupyter',
                    valid: true,
                    displayName: '',
                    baseUrl: '',
                    localProcExitCode: undefined,
                    disconnected: new EventEmitter<number>().event,
                    dispose: noop,
                    hostName: '',
                    localLaunch,
                    token: '',
                    rootDirectory: EXTENSION_ROOT_DIR
                };
                when(notebook.connection).thenReturn(connection);
            });
            test('Prompt to use CDN', async () => {
                when(appShell.showInformationMessage(anything(), anything(), anything(), anything())).thenResolve();

                await scriptSourceProvider.getWidgetScriptSource('HelloWorld', '1');

                verify(
                    appShell.showInformationMessage(
                        DataScience.useCDNForWidgets(),
                        Common.ok(),
                        Common.cancel(),
                        Common.doNotShowAgain()
                    )
                ).once();
            });
            test('Do  not prompt to use CDN if user has chosen not to use a CDN', async () => {
                when(appShell.showInformationMessage(anything(), anything(), anything(), anything())).thenResolve();
                when(userSelectedOkOrDoNotShowAgainInPrompt.value).thenReturn(true);

                await scriptSourceProvider.getWidgetScriptSource('HelloWorld', '1');

                verify(
                    appShell.showInformationMessage(
                        DataScience.useCDNForWidgets(),
                        Common.ok(),
                        Common.cancel(),
                        Common.doNotShowAgain()
                    )
                ).never();
            });
            function verifyNoCDNUpdatedInSettings() {
                // Confirm message was displayed.
                verify(
                    appShell.showInformationMessage(
                        DataScience.useCDNForWidgets(),
                        Common.ok(),
                        Common.cancel(),
                        Common.doNotShowAgain()
                    )
                ).once();

                // Confirm settings were updated.
                verify(
                    configService.updateSetting(
                        'dataScience.widgetScriptSources',
                        deepEqual([]),
                        undefined,
                        ConfigurationTarget.Global
                    )
                ).once();
            }
            test('Do not update if prompt is dismissed', async () => {
                when(appShell.showInformationMessage(anything(), anything(), anything(), anything())).thenResolve();

                await scriptSourceProvider.getWidgetScriptSource('HelloWorld', '1');

                verify(configService.updateSetting(anything(), anything(), anything(), anything())).never();
                verify(userSelectedOkOrDoNotShowAgainInPrompt.updateValue(true)).never();
            });
            test('Do not update settings if Cancel is clicked in prompt', async () => {
                when(appShell.showInformationMessage(anything(), anything(), anything(), anything())).thenResolve(
                    Common.cancel() as any
                );

                await scriptSourceProvider.getWidgetScriptSource('HelloWorld', '1');

                verify(configService.updateSetting(anything(), anything(), anything(), anything())).never();
                verify(userSelectedOkOrDoNotShowAgainInPrompt.updateValue(true)).never();
            });
            test('Update settings to not use CDN if `Do Not Show Again` is clicked in prompt', async () => {
                when(appShell.showInformationMessage(anything(), anything(), anything(), anything())).thenResolve(
                    Common.doNotShowAgain() as any
                );

                await scriptSourceProvider.getWidgetScriptSource('HelloWorld', '1');

                verifyNoCDNUpdatedInSettings();
                verify(userSelectedOkOrDoNotShowAgainInPrompt.updateValue(true)).once();
            });
            test('Update settings to use CDN based on prompt', async () => {
                when(appShell.showInformationMessage(anything(), anything(), anything(), anything())).thenResolve(
                    Common.ok() as any
                );

                await scriptSourceProvider.getWidgetScriptSource('HelloWorld', '1');

                // Confirm message was displayed.
                verify(
                    appShell.showInformationMessage(
                        DataScience.useCDNForWidgets(),
                        Common.ok(),
                        Common.cancel(),
                        Common.doNotShowAgain()
                    )
                ).once();
                // Confirm settings were updated.
                verify(userSelectedOkOrDoNotShowAgainInPrompt.updateValue(true)).once();
                verify(
                    configService.updateSetting(
                        'dataScience.widgetScriptSources',
                        deepEqual(['jsdelivr.com', 'unpkg.com']),
                        undefined,
                        ConfigurationTarget.Global
                    )
                ).once();
            });
            test('Attempt to get widget source from all providers', async () => {
                settings.datascience.widgetScriptSources = ['jsdelivr.com', 'unpkg.com'];
                const localOrRemoteSource = localLaunch
                    ? sinon.stub(LocalWidgetScriptSourceProvider.prototype, 'getWidgetScriptSource')
                    : sinon.stub(RemoteWidgetScriptSourceProvider.prototype, 'getWidgetScriptSource');
                const cdnSource = sinon.stub(CDNWidgetScriptSourceProvider.prototype, 'getWidgetScriptSource');

                localOrRemoteSource.resolves({ moduleName: 'HelloWorld' });
                cdnSource.resolves({ moduleName: 'HelloWorld' });

                scriptSourceProvider.initialize();
                const value = await scriptSourceProvider.getWidgetScriptSource('HelloWorld', '1');

                assert.deepEqual(value, { moduleName: 'HelloWorld' });
                assert.isTrue(localOrRemoteSource.calledOnce);
                assert.isTrue(cdnSource.calledOnce);
            });
            test('Widget sources should respect changes to configuration settings', async () => {
                // 1. Search CDN then local/remote juptyer.
                settings.datascience.widgetScriptSources = ['jsdelivr.com', 'unpkg.com'];
                const localOrRemoteSource = localLaunch
                    ? sinon.stub(LocalWidgetScriptSourceProvider.prototype, 'getWidgetScriptSource')
                    : sinon.stub(RemoteWidgetScriptSourceProvider.prototype, 'getWidgetScriptSource');
                const cdnSource = sinon.stub(CDNWidgetScriptSourceProvider.prototype, 'getWidgetScriptSource');
                cdnSource.resolves({ moduleName: 'moduleCDN', scriptUri: '1', source: 'cdn' });

                scriptSourceProvider.initialize();
                let values = await scriptSourceProvider.getWidgetScriptSource('ModuleName', '`');

                assert.deepEqual(values, { moduleName: 'moduleCDN', scriptUri: '1', source: 'cdn' });
                assert.isFalse(localOrRemoteSource.calledOnce);
                assert.isTrue(cdnSource.calledOnce);

                // 2. Update settings to remove the use of CDNs
                localOrRemoteSource.reset();
                cdnSource.reset();
                localOrRemoteSource.resolves({ moduleName: 'moduleLocal', scriptUri: '1', source: 'local' });
                settings.datascience.widgetScriptSources = [];
                onDidChangeWorkspaceSettings.fire({ affectsConfiguration: () => true });

                values = await scriptSourceProvider.getWidgetScriptSource('ModuleName', '`');
                assert.deepEqual(values, { moduleName: 'moduleLocal', scriptUri: '1', source: 'local' });
                assert.isTrue(localOrRemoteSource.calledOnce);
                assert.isFalse(cdnSource.calledOnce);
            });
            test('Widget source should support fall back search', async () => {
                // 1. Search CDN and if that fails then get from local/remote.
                settings.datascience.widgetScriptSources = ['jsdelivr.com', 'unpkg.com'];
                const localOrRemoteSource = localLaunch
                    ? sinon.stub(LocalWidgetScriptSourceProvider.prototype, 'getWidgetScriptSource')
                    : sinon.stub(RemoteWidgetScriptSourceProvider.prototype, 'getWidgetScriptSource');
                const cdnSource = sinon.stub(CDNWidgetScriptSourceProvider.prototype, 'getWidgetScriptSource');
                localOrRemoteSource.resolves({ moduleName: 'moduleLocal', scriptUri: '1', source: 'local' });
                cdnSource.resolves({ moduleName: 'moduleCDN' });

                scriptSourceProvider.initialize();
                const value = await scriptSourceProvider.getWidgetScriptSource('', '');

                // 1. Confirm CDN was first searched, then local/remote
                assert.deepEqual(value, { moduleName: 'moduleLocal', scriptUri: '1', source: 'local' });
                assert.isTrue(localOrRemoteSource.calledOnce);
                assert.isTrue(cdnSource.calledOnce);
                // Confirm we first searched CDN before going to local/remote.
                cdnSource.calledBefore(localOrRemoteSource);
            });
            test('Widget sources from CDN should be given prefernce', async () => {
                settings.datascience.widgetScriptSources = ['jsdelivr.com', 'unpkg.com'];
                const localOrRemoteSource = localLaunch
                    ? sinon.stub(LocalWidgetScriptSourceProvider.prototype, 'getWidgetScriptSource')
                    : sinon.stub(RemoteWidgetScriptSourceProvider.prototype, 'getWidgetScriptSource');
                const cdnSource = sinon.stub(CDNWidgetScriptSourceProvider.prototype, 'getWidgetScriptSource');

                localOrRemoteSource.resolves({ moduleName: 'module1' });
                cdnSource.resolves({ moduleName: 'module1', scriptUri: '1', source: 'cdn' });

                scriptSourceProvider.initialize();
                const values = await scriptSourceProvider.getWidgetScriptSource('ModuleName', '1');

                assert.deepEqual(values, { moduleName: 'module1', scriptUri: '1', source: 'cdn' });
                assert.isFalse(localOrRemoteSource.calledOnce);
                assert.isTrue(cdnSource.calledOnce);
                verify(appShell.showWarningMessage(anything(), anything(), anything(), anything())).never();
            });
            test('When CDN is turned on and widget script is not found, then display a warning about script not found on CDN', async () => {
                settings.datascience.widgetScriptSources = ['jsdelivr.com', 'unpkg.com'];
                const localOrRemoteSource = localLaunch
                    ? sinon.stub(LocalWidgetScriptSourceProvider.prototype, 'getWidgetScriptSource')
                    : sinon.stub(RemoteWidgetScriptSourceProvider.prototype, 'getWidgetScriptSource');
                const cdnSource = sinon.stub(CDNWidgetScriptSourceProvider.prototype, 'getWidgetScriptSource');

                localOrRemoteSource.resolves({ moduleName: 'module1' });
                cdnSource.resolves({ moduleName: 'module1' });

                scriptSourceProvider.initialize();
                let values = await scriptSourceProvider.getWidgetScriptSource('module1', '1');

                assert.deepEqual(values, { moduleName: 'module1' });
                assert.isTrue(localOrRemoteSource.calledOnce);
                assert.isTrue(cdnSource.calledOnce);
                verify(
                    appShell.showWarningMessage(
                        DataScience.widgetScriptNotFoundOnCDNWidgetMightNotWork().format('module1'),
                        anything(),
                        anything(),
                        anything()
                    )
                ).once();

                // Ensure message is not displayed more than once.
                values = await scriptSourceProvider.getWidgetScriptSource('module1', '1');

                assert.deepEqual(values, { moduleName: 'module1' });
                assert.isTrue(localOrRemoteSource.calledTwice);
                assert.isTrue(cdnSource.calledTwice);
                verify(
                    appShell.showWarningMessage(
                        DataScience.widgetScriptNotFoundOnCDNWidgetMightNotWork().format('module1'),
                        anything(),
                        anything(),
                        anything()
                    )
                ).once();
            });
        });
    });
});
