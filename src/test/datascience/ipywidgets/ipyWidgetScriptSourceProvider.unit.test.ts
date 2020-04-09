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
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IConfigurationService, WidgetSettings } from '../../../client/common/types';
import { Common, DataScience } from '../../../client/common/utils/localize';
import { noop } from '../../../client/common/utils/misc';
import { CDNWidgetScriptSourceProvider } from '../../../client/datascience/ipywidgets/cdnWidgetScriptSourceProvider';
import { IPyWidgetScriptSourceProvider } from '../../../client/datascience/ipywidgets/ipyWidgetScriptSourceProvider';
import { LocalWidgetScriptSourceProvider } from '../../../client/datascience/ipywidgets/localWidgetScriptSourceProvider';
import { RemoteWidgetScriptSourceProvider } from '../../../client/datascience/ipywidgets/remoteWidgetScriptSourceProvider';
import { JupyterNotebookBase } from '../../../client/datascience/jupyter/jupyterNotebook';
import { IConnection, ILocalResourceUriConverter, INotebook } from '../../../client/datascience/types';
import { InterpreterService } from '../../../client/interpreter/interpreterService';

// tslint:disable: no-any no-invalid-this

suite('Data Science - ipywidget - Widget Script Source Provider', () => {
    let scriptSourceProvider: IPyWidgetScriptSourceProvider;
    let notebook: INotebook;
    let configService: IConfigurationService;
    let widgetSettings: WidgetSettings;
    let appShell: IApplicationShell;
    let workspaceService: IWorkspaceService;
    let onDidChangeWorkspaceSettings: EventEmitter<ConfigurationChangeEvent>;
    setup(() => {
        notebook = mock(JupyterNotebookBase);
        configService = mock(ConfigurationService);
        appShell = mock(ApplicationShell);
        workspaceService = mock(WorkspaceService);
        onDidChangeWorkspaceSettings = new EventEmitter<ConfigurationChangeEvent>();
        when(workspaceService.onDidChangeConfiguration).thenReturn(onDidChangeWorkspaceSettings.event);
        const httpClient = mock(HttpClient);
        const resourceConverter = mock<ILocalResourceUriConverter>();
        const fs = mock(FileSystem);
        const interpreterService = mock(InterpreterService);

        widgetSettings = { localConnectionScriptSources: [], remoteConnectionScriptSources: [] };
        const settings = { datascience: { widgets: widgetSettings } };
        when(configService.getSettings(anything())).thenReturn(settings as any);
        CDNWidgetScriptSourceProvider.validUrls = new Map<string, boolean>();
        scriptSourceProvider = new IPyWidgetScriptSourceProvider(
            instance(notebook),
            instance(resourceConverter),
            instance(fs),
            instance(interpreterService),
            instance(appShell),
            instance(configService),
            instance(workspaceService),
            instance(httpClient)
        );
    });
    teardown(() => sinon.restore());

    [true, false].forEach((localLaunch) => {
        suite(localLaunch ? 'Local Jupyter Server' : 'Remote Jupyter Server', () => {
            setup(() => {
                const connection: IConnection = {
                    baseUrl: '',
                    localProcExitCode: undefined,
                    disconnected: new EventEmitter<number>().event,
                    dispose: noop,
                    hostName: '',
                    localLaunch,
                    token: ''
                };
                when(notebook.connection).thenReturn(connection);
            });
            test('Return empty list when requesting sources for all known widgets (and nothing is configured)', async () => {
                const values = await scriptSourceProvider.getWidgetScriptSources();
                assert.deepEqual(values, []);
            });
            test('Prompt to use CDN', async () => {
                when(appShell.showInformationMessage(anything(), anything(), anything())).thenResolve();

                await scriptSourceProvider.getWidgetScriptSource('HelloWorld', '1');

                verify(
                    appShell.showInformationMessage(DataScience.useCDNForWidgets(), Common.ok(), Common.cancel())
                ).once();
            });
            function verifyNoCDNUpdatedInSettings() {
                // Confirm message was displayed.
                verify(
                    appShell.showInformationMessage(DataScience.useCDNForWidgets(), Common.ok(), Common.cancel())
                ).once();

                // Confirm settings were updated.
                verify(
                    configService.updateSetting(
                        'dataScience.widgets.localConnectionScriptSources',
                        deepEqual(['localPythonEnvironment']),
                        undefined,
                        ConfigurationTarget.Global
                    )
                ).once();
                verify(
                    configService.updateSetting(
                        'dataScience.widgets.remoteConnectionScriptSources',
                        deepEqual(['remoteJupyterServer']),
                        undefined,
                        ConfigurationTarget.Global
                    )
                ).once();
            }
            test('Update settings to not use CDN if prompt is dismissed', async () => {
                when(appShell.showInformationMessage(anything(), anything(), anything())).thenResolve();

                await scriptSourceProvider.getWidgetScriptSource('HelloWorld', '1');

                verifyNoCDNUpdatedInSettings();
            });
            test('Update settings to not use CDN if Cancel is clicked in prompt', async () => {
                when(appShell.showInformationMessage(anything(), anything(), anything())).thenResolve(
                    Common.cancel() as any
                );

                await scriptSourceProvider.getWidgetScriptSource('HelloWorld', '1');

                verifyNoCDNUpdatedInSettings();
            });
            test('Update settings to use CDN based on prompt', async () => {
                when(appShell.showInformationMessage(anything(), anything(), anything())).thenResolve(
                    Common.ok() as any
                );

                await scriptSourceProvider.getWidgetScriptSource('HelloWorld', '1');

                // Confirm message was displayed.
                verify(
                    appShell.showInformationMessage(DataScience.useCDNForWidgets(), Common.ok(), Common.cancel())
                ).once();

                // Confirm settings were updated.
                verify(
                    configService.updateSetting(
                        'dataScience.widgets.localConnectionScriptSources',
                        deepEqual(['jsdelivr.com', 'unpkg.com', 'localPythonEnvironment']),
                        undefined,
                        ConfigurationTarget.Global
                    )
                ).once();
                verify(
                    configService.updateSetting(
                        'dataScience.widgets.remoteConnectionScriptSources',
                        deepEqual(['jsdelivr.com', 'unpkg.com', 'remoteJupyterServer']),
                        undefined,
                        ConfigurationTarget.Global
                    )
                ).once();
            });
            test('Attempt to get widget sources from all providers', async () => {
                if (localLaunch) {
                    widgetSettings.localConnectionScriptSources = [
                        'jsdelivr.com',
                        'unpkg.com',
                        'localPythonEnvironment'
                    ];
                } else {
                    widgetSettings.remoteConnectionScriptSources = ['jsdelivr.com', 'unpkg.com', 'remoteJupyterServer'];
                }
                const localOrRemoteSource = localLaunch
                    ? sinon.stub(LocalWidgetScriptSourceProvider.prototype, 'getWidgetScriptSources')
                    : sinon.stub(RemoteWidgetScriptSourceProvider.prototype, 'getWidgetScriptSources');
                const cdnSource = sinon.stub(CDNWidgetScriptSourceProvider.prototype, 'getWidgetScriptSources');

                localOrRemoteSource.resolves([]);
                cdnSource.resolves([]);

                scriptSourceProvider.initialize();
                const values = await scriptSourceProvider.getWidgetScriptSources();

                assert.deepEqual(values, []);
                assert.isTrue(localOrRemoteSource.calledOnce);
                assert.isTrue(cdnSource.calledOnce);
            });
            test('Attempt to get widget source from all providers', async () => {
                if (localLaunch) {
                    widgetSettings.localConnectionScriptSources = [
                        'jsdelivr.com',
                        'unpkg.com',
                        'localPythonEnvironment'
                    ];
                } else {
                    widgetSettings.remoteConnectionScriptSources = ['jsdelivr.com', 'unpkg.com', 'remoteJupyterServer'];
                }
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
                if (localLaunch) {
                    widgetSettings.localConnectionScriptSources = [
                        'jsdelivr.com',
                        'unpkg.com',
                        'localPythonEnvironment'
                    ];
                } else {
                    widgetSettings.remoteConnectionScriptSources = ['jsdelivr.com', 'unpkg.com', 'remoteJupyterServer'];
                }
                const localOrRemoteSource = localLaunch
                    ? sinon.stub(LocalWidgetScriptSourceProvider.prototype, 'getWidgetScriptSources')
                    : sinon.stub(RemoteWidgetScriptSourceProvider.prototype, 'getWidgetScriptSources');
                const cdnSource = sinon.stub(CDNWidgetScriptSourceProvider.prototype, 'getWidgetScriptSources');
                cdnSource.resolves([{ moduleName: 'moduleCDN', scriptUri: '1', source: 'cdn' }]);

                scriptSourceProvider.initialize();
                let values = await scriptSourceProvider.getWidgetScriptSources();

                // 1. Confirm CDN was given preference.
                assert.deepEqual(values, [{ moduleName: 'moduleCDN', scriptUri: '1', source: 'cdn' }]);
                assert.isFalse(localOrRemoteSource.calledOnce);
                assert.isTrue(cdnSource.calledOnce);

                // 2. Update settings to use local python environment or remote jupyter in case of remote connection.
                localOrRemoteSource.reset();
                cdnSource.reset();
                localOrRemoteSource.resolves([{ moduleName: 'moduleLocal', scriptUri: '1', source: 'local' }]);
                if (localLaunch) {
                    widgetSettings.localConnectionScriptSources = [
                        'localPythonEnvironment',
                        'jsdelivr.com',
                        'unpkg.com'
                    ];
                } else {
                    widgetSettings.remoteConnectionScriptSources = ['remoteJupyterServer', 'jsdelivr.com', 'unpkg.com'];
                }
                onDidChangeWorkspaceSettings.fire({ affectsConfiguration: () => true });

                values = await scriptSourceProvider.getWidgetScriptSources();

                // Confirm Local source is given preference or remote was given preference.
                // Ie. we shoudln't have got the module from a CDN.
                assert.deepEqual(values, [{ moduleName: 'moduleLocal', scriptUri: '1', source: 'local' }]);
                assert.isTrue(localOrRemoteSource.calledOnce);
                assert.isFalse(cdnSource.calledOnce);

                // 3. Now removing local and remote jupyter, meaning we always want to get from CDN.
                localOrRemoteSource.reset();
                cdnSource.reset();
                cdnSource.resolves([{ moduleName: 'moduleCDN', scriptUri: '1', source: 'cdn' }]);
                if (localLaunch) {
                    widgetSettings.localConnectionScriptSources = ['jsdelivr.com'];
                } else {
                    widgetSettings.remoteConnectionScriptSources = ['jsdelivr.com'];
                }
                onDidChangeWorkspaceSettings.fire({ affectsConfiguration: () => true });

                values = await scriptSourceProvider.getWidgetScriptSources();

                // 2. Confirm we got the module from CDN and not from local/remote.
                assert.deepEqual(values, [{ moduleName: 'moduleCDN', scriptUri: '1', source: 'cdn' }]);
                assert.isFalse(localOrRemoteSource.calledOnce);
                assert.isTrue(cdnSource.calledOnce);
            });
            test('Widget source should respect changes to configuration settings', async () => {
                // 1. Search CDN then local/remote juptyer.
                if (localLaunch) {
                    widgetSettings.localConnectionScriptSources = [
                        'jsdelivr.com',
                        'unpkg.com',
                        'localPythonEnvironment'
                    ];
                } else {
                    widgetSettings.remoteConnectionScriptSources = ['jsdelivr.com', 'unpkg.com', 'remoteJupyterServer'];
                }
                const localOrRemoteSource = localLaunch
                    ? sinon.stub(LocalWidgetScriptSourceProvider.prototype, 'getWidgetScriptSource')
                    : sinon.stub(RemoteWidgetScriptSourceProvider.prototype, 'getWidgetScriptSource');
                const cdnSource = sinon.stub(CDNWidgetScriptSourceProvider.prototype, 'getWidgetScriptSource');
                cdnSource.resolves({ moduleName: 'moduleCDN', scriptUri: '1', source: 'cdn' });

                scriptSourceProvider.initialize();
                let value = await scriptSourceProvider.getWidgetScriptSource('', '');

                // 1. Confirm CDN was given preference.
                assert.deepEqual(value, { moduleName: 'moduleCDN', scriptUri: '1', source: 'cdn' });
                assert.isFalse(localOrRemoteSource.calledOnce);
                assert.isTrue(cdnSource.calledOnce);

                // 2. Update settings to use local python environment or remote jupyter in case of remote connection.
                localOrRemoteSource.reset();
                cdnSource.reset();
                localOrRemoteSource.resolves({ moduleName: 'moduleLocal', scriptUri: '1', source: 'local' });
                if (localLaunch) {
                    widgetSettings.localConnectionScriptSources = [
                        'localPythonEnvironment',
                        'jsdelivr.com',
                        'unpkg.com'
                    ];
                } else {
                    widgetSettings.remoteConnectionScriptSources = ['remoteJupyterServer', 'jsdelivr.com', 'unpkg.com'];
                }
                onDidChangeWorkspaceSettings.fire({ affectsConfiguration: () => true });

                value = await scriptSourceProvider.getWidgetScriptSource('', '');

                // Confirm Local source is given preference or remote was given preference.
                // Ie. we shoudln't have got the module from a CDN.
                assert.deepEqual(value, { moduleName: 'moduleLocal', scriptUri: '1', source: 'local' });
                assert.isTrue(localOrRemoteSource.calledOnce);
                assert.isFalse(cdnSource.calledOnce);

                // 3. Now removing local and remote jupyter, meaning we always want to get from CDN.
                localOrRemoteSource.reset();
                cdnSource.reset();
                cdnSource.resolves({ moduleName: 'moduleCDN', scriptUri: '1', source: 'cdn' });
                if (localLaunch) {
                    widgetSettings.localConnectionScriptSources = ['jsdelivr.com'];
                } else {
                    widgetSettings.remoteConnectionScriptSources = ['jsdelivr.com'];
                }
                onDidChangeWorkspaceSettings.fire({ affectsConfiguration: () => true });

                value = await scriptSourceProvider.getWidgetScriptSource('', '');

                // 2. Confirm we got the module from CDN and not from local/remote.
                assert.deepEqual(value, { moduleName: 'moduleCDN', scriptUri: '1', source: 'cdn' });
                assert.isFalse(localOrRemoteSource.calledOnce);
                assert.isTrue(cdnSource.calledOnce);
            });
            test('Widget source should support fall back search', async () => {
                // 1. Search CDN and if that fails then get from local/remote.
                if (localLaunch) {
                    widgetSettings.localConnectionScriptSources = [
                        'jsdelivr.com',
                        'unpkg.com',
                        'localPythonEnvironment'
                    ];
                } else {
                    widgetSettings.remoteConnectionScriptSources = ['jsdelivr.com', 'unpkg.com', 'remoteJupyterServer'];
                }
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
            test('Widget sources from CDN should be given prefernce', async function () {
                if (!localLaunch) {
                    return this.skip();
                }
                widgetSettings.localConnectionScriptSources = ['jsdelivr.com', 'unpkg.com', 'localPythonEnvironment'];
                const localSource = sinon.stub(LocalWidgetScriptSourceProvider.prototype, 'getWidgetScriptSources');
                const cdnSource = sinon.stub(CDNWidgetScriptSourceProvider.prototype, 'getWidgetScriptSources');

                localSource.resolves([]);
                cdnSource.resolves([{ moduleName: 'module1', scriptUri: '1', source: 'cdn' }]);

                scriptSourceProvider.initialize();
                const values = await scriptSourceProvider.getWidgetScriptSources();

                assert.deepEqual(values, [{ moduleName: 'module1', scriptUri: '1', source: 'cdn' }]);
                assert.isFalse(localSource.calledOnce);
                assert.isTrue(cdnSource.calledOnce);
            });
            test('Widget sources from Local should be given prefernce', async function () {
                if (!localLaunch) {
                    return this.skip();
                }
                widgetSettings.localConnectionScriptSources = ['localPythonEnvironment', 'jsdelivr.com', 'unpkg.com'];
                const localSource = sinon.stub(LocalWidgetScriptSourceProvider.prototype, 'getWidgetScriptSources');
                const cdnSource = sinon.stub(CDNWidgetScriptSourceProvider.prototype, 'getWidgetScriptSources');

                localSource.resolves([{ moduleName: 'module1', scriptUri: '1', source: 'cdn' }]);
                cdnSource.resolves([]);

                scriptSourceProvider.initialize();
                const values = await scriptSourceProvider.getWidgetScriptSources();

                assert.deepEqual(values, [{ moduleName: 'module1', scriptUri: '1', source: 'cdn' }]);
                assert.isTrue(localSource.calledOnce);
                assert.isFalse(cdnSource.calledOnce);
            });
        });
    });
});
