// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { assert } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { EventEmitter } from 'vscode';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { HttpClient } from '../../../client/common/net/httpClient';
import { IConfigurationService, IHttpClient, WidgetCDNs } from '../../../client/common/types';
import { noop } from '../../../client/common/utils/misc';
import { CDNWidgetScriptSourceProvider } from '../../../client/datascience/ipywidgets/cdnWidgetScriptSourceProvider';
import { IWidgetScriptSourceProvider, WidgetScriptSource } from '../../../client/datascience/ipywidgets/types';
import { JupyterNotebookBase } from '../../../client/datascience/jupyter/jupyterNotebook';
import { IJupyterConnection, INotebook } from '../../../client/datascience/types';

const unpgkUrl = 'https://unpkg.com/';
const jsdelivrUrl = 'https://cdn.jsdelivr.net/npm/';

// tslint:disable: max-func-body-length no-any
suite('Data Science - ipywidget - CDN', () => {
    let scriptSourceProvider: IWidgetScriptSourceProvider;
    let notebook: INotebook;
    let configService: IConfigurationService;
    let httpClient: IHttpClient;
    let settings: PythonSettings;
    setup(() => {
        notebook = mock(JupyterNotebookBase);
        configService = mock(ConfigurationService);
        httpClient = mock(HttpClient);
        settings = { datascience: { widgetScriptSources: [] } } as any;
        when(configService.getSettings(anything())).thenReturn(settings as any);
        CDNWidgetScriptSourceProvider.validUrls = new Map<string, boolean>();
        scriptSourceProvider = new CDNWidgetScriptSourceProvider(instance(configService), instance(httpClient));
    });

    [true, false].forEach((localLaunch) => {
        suite(localLaunch ? 'Local Jupyter Server' : 'Remote Jupyter Server', () => {
            setup(() => {
                const connection: IJupyterConnection = {
                    type: 'jupyter',
                    baseUrl: '',
                    localProcExitCode: undefined,
                    valid: true,
                    displayName: '',
                    disconnected: new EventEmitter<number>().event,
                    dispose: noop,
                    hostName: '',
                    localLaunch,
                    token: ''
                };
                when(notebook.connection).thenReturn(connection);
            });
            test('Script source will be empty if CDN is not a configured source of widget scripts in settings', async () => {
                const value = await scriptSourceProvider.getWidgetScriptSource('HelloWorld', '1');

                assert.deepEqual(value, { moduleName: 'HelloWorld' });
                // Should not make any http calls.
                verify(httpClient.exists(anything())).never();
            });
            function updateCDNSettings(...values: WidgetCDNs[]) {
                settings.datascience.widgetScriptSources = values;
            }
            (['unpkg.com', 'jsdelivr.com'] as WidgetCDNs[]).forEach((cdn) => {
                suite(cdn, () => {
                    const moduleName = 'HelloWorld';
                    const moduleVersion = '1';
                    let expectedSource = '';
                    setup(() => {
                        const baseUrl = cdn === 'unpkg.com' ? unpgkUrl : jsdelivrUrl;
                        expectedSource = `${baseUrl}${moduleName}@${moduleVersion}/dist/index`;
                        CDNWidgetScriptSourceProvider.validUrls = new Map<string, boolean>();
                    });
                    test('Get widget source from CDN', async () => {
                        updateCDNSettings(cdn);
                        when(httpClient.exists(anything())).thenResolve(true);

                        const value = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);

                        assert.deepEqual(value, {
                            moduleName: 'HelloWorld',
                            scriptUri: expectedSource,
                            source: 'cdn'
                        });
                        verify(httpClient.exists(anything())).once();
                    });
                    test('Ensure widgtet script is downloaded once and cached', async () => {
                        updateCDNSettings(cdn);
                        when(httpClient.exists(anything())).thenResolve(true);
                        const expectedValue: WidgetScriptSource = {
                            moduleName: 'HelloWorld',
                            scriptUri: expectedSource,
                            source: 'cdn'
                        };

                        const value = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);
                        assert.deepEqual(value, expectedValue);
                        const value1 = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);
                        assert.deepEqual(value1, expectedValue);
                        const value2 = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);
                        assert.deepEqual(value2, expectedValue);

                        // Only one http request
                        verify(httpClient.exists(anything())).once();
                    });
                    test('No script source if package does not exist on CDN', async () => {
                        updateCDNSettings(cdn);
                        when(httpClient.exists(anything())).thenResolve(false);

                        const value = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);

                        assert.deepEqual(value, { moduleName: 'HelloWorld' });
                        verify(httpClient.exists(anything())).once();
                    });
                    test('No script source if package does not exist on both CDNs', async () => {
                        updateCDNSettings('jsdelivr.com', 'unpkg.com');
                        when(httpClient.exists(anything())).thenResolve(false);

                        const value = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);

                        assert.deepEqual(value, { moduleName: 'HelloWorld' });
                    });
                    test('Give preference to jsdelivr over unpkg', async () => {
                        updateCDNSettings('jsdelivr.com', 'unpkg.com');
                        when(httpClient.exists(anything())).thenResolve(true);

                        const value = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);

                        assert.deepEqual(value, {
                            moduleName: 'HelloWorld',
                            scriptUri: `${jsdelivrUrl}${moduleName}@${moduleVersion}/dist/index`,
                            source: 'cdn'
                        });
                        verify(httpClient.exists(anything())).once();
                    });
                    test('Give preference to unpkg over jsdelivr', async () => {
                        updateCDNSettings('unpkg.com', 'jsdelivr.com');
                        when(httpClient.exists(anything())).thenResolve(true);

                        const value = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);

                        assert.deepEqual(value, {
                            moduleName: 'HelloWorld',
                            scriptUri: `${unpgkUrl}${moduleName}@${moduleVersion}/dist/index`,
                            source: 'cdn'
                        });
                        verify(httpClient.exists(anything())).once();
                    });
                    test('Get Script from unpk if jsdelivr fails', async () => {
                        updateCDNSettings('jsdelivr.com', 'unpkg.com');
                        when(httpClient.exists(anything())).thenCall(
                            async (url: string) => !url.startsWith(jsdelivrUrl)
                        );

                        const value = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);

                        assert.deepEqual(value, {
                            moduleName: 'HelloWorld',
                            scriptUri: `${unpgkUrl}${moduleName}@${moduleVersion}/dist/index`,
                            source: 'cdn'
                        });
                        verify(httpClient.exists(anything())).twice();
                    });
                    test('Get Script from jsdelivr if unpkg fails', async () => {
                        updateCDNSettings('unpkg.com', 'jsdelivr.com');
                        when(httpClient.exists(anything())).thenCall(async (url: string) => !url.startsWith(unpgkUrl));

                        const value = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);

                        assert.deepEqual(value, {
                            moduleName: 'HelloWorld',
                            scriptUri: `${jsdelivrUrl}${moduleName}@${moduleVersion}/dist/index`,
                            source: 'cdn'
                        });
                        verify(httpClient.exists(anything())).twice();
                    });
                    test('No script source if downloading from both CDNs fail', async () => {
                        updateCDNSettings('unpkg.com', 'jsdelivr.com');
                        when(httpClient.exists(anything())).thenResolve(false);

                        const value = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);

                        assert.deepEqual(value, { moduleName: 'HelloWorld' });
                        verify(httpClient.exists(anything())).twice();
                    });
                });
            });
        });
    });
});
