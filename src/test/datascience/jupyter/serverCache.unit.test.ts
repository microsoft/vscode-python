// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { assert } from 'chai';
import { instance, mock, when } from 'ts-mockito';
import { CancellationToken } from 'vscode';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { sleep } from '../../../client/common/utils/async';
import { ServerCache } from '../../../client/datascience/jupyter/liveshare/serverCache';
import { INotebookServerOptions } from '../../../client/datascience/types';
import { MockAutoSelectionService } from '../../mocks/autoSelector';
import { MockJupyterServer } from '../mockJupyterServer';

// tslint:disable: max-func-body-length
suite('Data Science - ServerCache', () => {
    let serverCache: ServerCache;
    const fileSystem = mock(FileSystem);
    const workspaceService = mock(WorkspaceService);
    const configService = mock(ConfigurationService);
    const server = new MockJupyterServer();
    const pythonSettings = new PythonSettings(undefined, new MockAutoSelectionService());

    setup(() => {
        // Setup default settings
        pythonSettings.datascience = {
            allowImportFromNotebook: true,
            jupyterLaunchTimeout: 10,
            jupyterLaunchRetries: 3,
            enabled: true,
            jupyterServerURI: 'local',
            // tslint:disable-next-line: no-invalid-template-strings
            notebookFileRoot: '${fileDirname}',
            changeDirOnImportExport: true,
            useDefaultConfigForJupyter: true,
            jupyterInterruptTimeout: 10000,
            searchForJupyter: false,
            showCellInputCode: true,
            collapseCellInputCodeByDefault: true,
            allowInput: true,
            maxOutputSize: 400,
            errorBackgroundColor: '#FFFFFF',
            sendSelectionToInteractiveWindow: false,
            variableExplorerExclude: 'module;function;builtin_function_or_method',
            codeRegularExpression: '^(#\\s*%%|#\\s*\\<codecell\\>|#\\s*In\\[\\d*?\\]|#\\s*In\\[ \\])',
            markdownRegularExpression: '^(#\\s*%%\\s*\\[markdown\\]|#\\s*\\<markdowncell\\>)',
            allowLiveShare: false,
            enablePlotViewer: true,
            runStartupCommands: '',
            debugJustMyCode: true,
            variableQueries: [],
            jupyterCommandLineArguments: []
        };
        when(configService.getSettings()).thenReturn(pythonSettings);
        serverCache = new ServerCache(instance(configService), instance(workspaceService), instance(fileSystem));
    });

    test('Cache works on second get', async () => {
        const options: INotebookServerOptions = {
            purpose: 'test'
        };
        const func = () => {
            return Promise.resolve(server);
        };
        const result = await serverCache.getOrCreate(func, options);
        assert.ok(result, 'first get did not work');
        const r2 = await serverCache.get(options);
        assert.equal(result, r2, 'Second get did not work');
    });

    test('Cache with UI will cancel original get', async () => {
        let token: CancellationToken | undefined;
        const options: INotebookServerOptions = {
            purpose: 'test',
            disableUI: true
        };
        serverCache
            .getOrCreate(async (_o, t) => {
                token = t;
                await sleep(500);
                return Promise.resolve(server);
            }, options)
            .ignoreErrors();
        const options2 = { ...options, disableUI: false };
        const result2 = await serverCache.getOrCreate(async () => {
            return Promise.resolve(server);
        }, options2);
        assert.ok(result2, 'Second did not work');
        assert.equal(token?.isCancellationRequested, true, 'First request was not canceled');
    });
});
