// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { assert } from 'chai';
import * as fs from 'fs-extra';
import * as nock from 'nock';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { EventEmitter } from 'vscode';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { HttpClient } from '../../../client/common/net/httpClient';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../client/common/platform/types';
import { IConfigurationService, IHttpClient, WidgetCDNs } from '../../../client/common/types';
import { noop } from '../../../client/common/utils/misc';
import { CDNWidgetScriptSourceProvider } from '../../../client/datascience/ipywidgets/cdnWidgetScriptSourceProvider';
import { IPyWidgetScriptSource } from '../../../client/datascience/ipywidgets/ipyWidgetScriptSource';
import { IWidgetScriptSourceProvider, WidgetScriptSource } from '../../../client/datascience/ipywidgets/types';
import { JupyterNotebookBase } from '../../../client/datascience/jupyter/jupyterNotebook';
import { IJupyterConnection, ILocalResourceUriConverter, INotebook } from '../../../client/datascience/types';

// tslint:disable: no-var-requires no-require-imports max-func-body-length no-any match-default-export-name
const request = require('request');

const unpgkUrl = 'https://unpkg.com/';
const jsdelivrUrl = 'https://cdn.jsdelivr.net/npm/';

// tslint:disable: max-func-body-length no-any
suite('DataScience - ipywidget - CDN', () => {
    let scriptSourceProvider: IWidgetScriptSourceProvider;
    let notebook: INotebook;
    let configService: IConfigurationService;
    let httpClient: IHttpClient;
    let settings: PythonSettings;
    let fileSystem: IFileSystem;
    let webviewUriConverter: ILocalResourceUriConverter;
    let tempFileCount = 0;
    setup(() => {
        notebook = mock(JupyterNotebookBase);
        configService = mock(ConfigurationService);
        httpClient = mock(HttpClient);
        fileSystem = mock(FileSystem);
        webviewUriConverter = mock(IPyWidgetScriptSource);
        settings = { datascience: { widgetScriptSources: [] } } as any;
        when(configService.getSettings(anything())).thenReturn(settings as any);
        when(httpClient.downloadFile(anything())).thenCall(request);
        when(fileSystem.fileExists(anything())).thenCall((f) => fs.pathExists(f));

        when(fileSystem.createTemporaryFile(anything())).thenCall(createTemporaryFile);
        when(fileSystem.createWriteStream(anything())).thenCall((p) => fs.createWriteStream(p));
        when(fileSystem.createDirectory(anything())).thenCall((d) => fs.ensureDir(d));
        CDNWidgetScriptSourceProvider.validUrls = new Map<string, boolean>();
        scriptSourceProvider = new CDNWidgetScriptSourceProvider(
            instance(configService),
            instance(httpClient),
            instance(webviewUriConverter),
            instance(fileSystem)
        );
    });

    function createStreamFromString(str: string) {
        const readable = new Readable();
        readable._read = noop;
        readable.push(str);
        readable.push(null);
        return readable;
    }

    function createTemporaryFile(ext: string) {
        tempFileCount += 1;
        const filePath = path.join(os.tmpdir(), `tempfile_for_test${tempFileCount}.${ext}`);
        return {
            filePath,
            dispose: () => {
                fs.removeSync(filePath);
            }
        };
    }

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
                    let baseUrl = '';
                    let getUrl = '';
                    setup(() => {
                        baseUrl = cdn === 'unpkg.com' ? unpgkUrl : jsdelivrUrl;
                        getUrl =
                            cdn === 'unpkg.com'
                                ? `${moduleName}@${moduleVersion}/dist/index`
                                : `${moduleName}@${moduleVersion}/dist/index.js`;
                        expectedSource = `${baseUrl}${getUrl}`;
                        CDNWidgetScriptSourceProvider.validUrls = new Map<string, boolean>();
                    });
                    test('Get widget source from CDN', async () => {
                        updateCDNSettings(cdn);

                        const value = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);

                        assert.deepEqual(value, {
                            moduleName: 'HelloWorld',
                            scriptUri: expectedSource,
                            source: 'cdn'
                        });
                    });
                    test('Ensure widget script is downloaded once and cached', async () => {
                        let downloadCount = 0;
                        nock(baseUrl)
                            .get(getUrl)
                            .reply(200, () => {
                                downloadCount += 1;
                                return createStreamFromString('foo');
                            });

                        const value = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);

                        assert.deepEqual(value, {
                            moduleName: 'HelloWorld',
                            scriptUri: expectedSource,
                            source: 'cdn'
                        });

                        const value2 = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);

                        assert.deepEqual(value2, {
                            moduleName: 'HelloWorld',
                            scriptUri: expectedSource,
                            source: 'cdn'
                        });

                        assert.equal(downloadCount, 1, 'Downloaded more than once');
                    });
                    test('No script source if package does not exist on CDN', async () => {});
                    test('No script source if package does not exist on both CDNs', async () => {});
                    test('Get Script from unpk if jsdelivr fails', async () => {});
                    test('Get Script from jsdelivr if unpkg fails', async () => {});
                    test('No script source if downloading from both CDNs fail', async () => {});
                });
            });
        });
    });
});
