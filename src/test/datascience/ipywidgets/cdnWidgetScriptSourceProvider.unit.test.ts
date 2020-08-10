// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { assert } from 'chai';
import * as fs from 'fs-extra';
import { sha256 } from 'hash.js';
import { shutdown } from 'log4js';
import * as nock from 'nock';
import * as path from 'path';
import { Readable } from 'stream';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { EventEmitter, Uri } from 'vscode';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { HttpClient } from '../../../client/common/net/httpClient';
import { IConfigurationService, IHttpClient, WidgetCDNs } from '../../../client/common/types';
import { noop } from '../../../client/common/utils/misc';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';
import { DataScienceFileSystem } from '../../../client/datascience/dataScienceFileSystem';
import { CDNWidgetScriptSourceProvider } from '../../../client/datascience/ipywidgets/cdnWidgetScriptSourceProvider';
import { IPyWidgetScriptSource } from '../../../client/datascience/ipywidgets/ipyWidgetScriptSource';
import { IWidgetScriptSourceProvider } from '../../../client/datascience/ipywidgets/types';
import { JupyterNotebookBase } from '../../../client/datascience/jupyter/jupyterNotebook';
import {
    IDataScienceFileSystem,
    IJupyterConnection,
    ILocalResourceUriConverter,
    INotebook
} from '../../../client/datascience/types';

// tslint:disable: no-var-requires no-require-imports max-func-body-length no-any match-default-export-name no-console
const request = require('request');
const sanitize = require('sanitize-filename');

const unpgkUrl = 'https://unpkg.com/';
const jsdelivrUrl = 'https://cdn.jsdelivr.net/npm/';

// tslint:disable: max-func-body-length no-any
suite('DataScience - ipywidget - CDN', () => {
    let scriptSourceProvider: IWidgetScriptSourceProvider;
    let notebook: INotebook;
    let configService: IConfigurationService;
    let httpClient: IHttpClient;
    let settings: PythonSettings;
    let fileSystem: IDataScienceFileSystem;
    let webviewUriConverter: ILocalResourceUriConverter;
    let tempFileCount = 0;
    suiteSetup(function () {
        // Nock seems to fail randomly on CI builds. See bug
        // https://github.com/microsoft/vscode-python/issues/11442
        // tslint:disable-next-line: no-invalid-this
        return this.skip();
    });
    setup(() => {
        notebook = mock(JupyterNotebookBase);
        configService = mock(ConfigurationService);
        httpClient = mock(HttpClient);
        fileSystem = mock(DataScienceFileSystem);
        webviewUriConverter = mock(IPyWidgetScriptSource);
        settings = { datascience: { widgetScriptSources: [] } } as any;
        when(configService.getSettings(anything())).thenReturn(settings as any);
        when(httpClient.downloadFile(anything())).thenCall(request);
        when(fileSystem.localFileExists(anything())).thenCall((f) => fs.pathExists(f));

        when(fileSystem.createTemporaryLocalFile(anything())).thenCall(createTemporaryFile);
        when(fileSystem.createLocalWriteStream(anything())).thenCall((p) => fs.createWriteStream(p));
        when(fileSystem.createDirectory(anything())).thenCall((d) => fs.ensureDir(d));
        when(webviewUriConverter.rootScriptFolder).thenReturn(
            Uri.file(path.join(EXTENSION_ROOT_DIR, 'tmp', 'scripts'))
        );
        when(webviewUriConverter.asWebviewUri(anything())).thenCall((u) => u);
        scriptSourceProvider = new CDNWidgetScriptSourceProvider(
            instance(configService),
            instance(httpClient),
            instance(webviewUriConverter),
            instance(fileSystem)
        );
    });

    shutdown(() => {
        clearDiskCache();
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

        // Put temp files next to extension so we can clean them up later
        const filePath = path.join(
            EXTENSION_ROOT_DIR,
            'tmp',
            'tempfile_loc',
            `tempfile_for_test${tempFileCount}.${ext}`
        );
        fs.createFileSync(filePath);
        return {
            filePath,
            dispose: () => {
                fs.removeSync(filePath);
            }
        };
    }

    function generateScriptName(moduleName: string, moduleVersion: string) {
        const hash = sanitize(sha256().update(`${moduleName}${moduleVersion}`).digest('hex'));
        return Uri.file(path.join(EXTENSION_ROOT_DIR, 'tmp', 'scripts', hash, 'index.js')).toString();
    }

    function clearDiskCache() {
        try {
            fs.removeSync(path.join(EXTENSION_ROOT_DIR, 'tmp', 'scripts'));
            fs.removeSync(path.join(EXTENSION_ROOT_DIR, 'tmp', 'tempfile_loc'));
        } catch {
            // Swallow any errors here
        }
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
                    token: '',
                    rootDirectory: ''
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
                    let baseUrl = '';
                    let scriptUri = '';
                    setup(() => {
                        baseUrl = cdn === 'unpkg.com' ? unpgkUrl : jsdelivrUrl;
                        scriptUri = generateScriptName(moduleName, moduleVersion);
                    });
                    teardown(() => {
                        clearDiskCache();
                        scriptSourceProvider.dispose();
                        nock.cleanAll();
                    });
                    test('Ensure widget script is downloaded once and cached', async () => {
                        updateCDNSettings(cdn);
                        let downloadCount = 0;
                        nock(baseUrl)
                            .log(console.log)

                            .get(/.*/)
                            .reply(200, () => {
                                downloadCount += 1;
                                return createStreamFromString('foo');
                            });

                        const value = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);

                        assert.deepEqual(value, {
                            moduleName: 'HelloWorld',
                            scriptUri,
                            source: 'cdn'
                        });

                        const value2 = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);

                        assert.deepEqual(value2, {
                            moduleName: 'HelloWorld',
                            scriptUri,
                            source: 'cdn'
                        });

                        assert.equal(downloadCount, 1, 'Downloaded more than once');
                    });
                    test('No script source if package does not exist on CDN', async () => {
                        updateCDNSettings(cdn);
                        nock(baseUrl).log(console.log).get(/.*/).replyWithError('404');

                        const value = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);

                        assert.deepEqual(value, {
                            moduleName: 'HelloWorld'
                        });
                    });
                    test('Script source if package does not exist on both CDNs', async () => {
                        // Add the other cdn (the opposite of the working one)
                        const cdns =
                            cdn === 'unpkg.com'
                                ? ([cdn, 'jsdelivr.com'] as WidgetCDNs[])
                                : ([cdn, 'unpkg.com'] as WidgetCDNs[]);
                        updateCDNSettings(cdns[0], cdns[1]);
                        // Make only one cdn available
                        when(httpClient.exists(anything())).thenCall((a) => {
                            if (a.includes(cdn[0])) {
                                return true;
                            }
                            return false;
                        });
                        nock(baseUrl)
                            .get(/.*/)
                            .reply(200, () => {
                                return createStreamFromString('foo');
                            });
                        const value = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);

                        assert.deepEqual(value, {
                            moduleName: 'HelloWorld',
                            scriptUri,
                            source: 'cdn'
                        });
                    });

                    test('Retry if busy', async () => {
                        let retryCount = 0;
                        updateCDNSettings(cdn);
                        when(httpClient.exists(anything())).thenResolve(true);
                        nock(baseUrl).log(console.log).get(/.*/).twice().replyWithError('Not found');
                        nock(baseUrl)
                            .log(console.log)
                            .get(/.*/)
                            .thrice()
                            .reply(200, () => {
                                retryCount = 3;
                                return createStreamFromString('foo');
                            });

                        // Then see if we can get it still.
                        const value = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);

                        assert.deepEqual(value, {
                            moduleName: 'HelloWorld',
                            scriptUri,
                            source: 'cdn'
                        });
                        assert.equal(retryCount, 3, 'Did not actually retry');
                    });
                    test('Script source already on disk', async () => {
                        updateCDNSettings(cdn);
                        // Make nobody available
                        when(httpClient.exists(anything())).thenResolve(true);

                        // Write to where the file should eventually end up
                        const filePath = Uri.parse(scriptUri).fsPath;
                        await fs.createFile(filePath);
                        await fs.writeFile(filePath, 'foo');

                        // Then see if we can get it still.
                        const value = await scriptSourceProvider.getWidgetScriptSource(moduleName, moduleVersion);

                        assert.deepEqual(value, {
                            moduleName: 'HelloWorld',
                            scriptUri,
                            source: 'cdn'
                        });
                    });
                });
            });
        });
    });
});
