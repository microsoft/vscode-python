// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { commands, ConfigurationTarget, Uri } from 'vscode';
import { IWorkspaceService } from '../../client/common/application/types';
import { IFileSystem } from '../../client/common/platform/types';
import { IPythonToolExecutionService } from '../../client/common/process/types';
import { IDisposable, Product } from '../../client/common/types';
import { INotebookEditorProvider } from '../../client/datascience/types';
import { IExtensionTestApi } from '../common';
import {
    canRunTests,
    closeNotebooksAndCleanUpAfterTests,
    createTemporaryNotebook,
    disposeAllDisposables,
    swallowSavingOfNotebooks
} from '../datascience/notebook/helper';
import { EXTENSION_ROOT_DIR_FOR_TESTS, initialize, initializeTest } from '../initialize';

// tslint:disable: no-any no-invalid-this
suite('Formatting - Notebooks', () => {
    let api: IExtensionTestApi;
    suiteSetup(async function () {
        api = await initialize();
        if (!(await canRunTests())) {
            return this.skip();
        }
    });
    suiteTeardown(closeNotebooksAndCleanUpAfterTests);
    ['yapf', 'black', 'autopep8'].forEach((formatter) => {
        suite(formatter, () => {
            const disposables: IDisposable[] = [];
            let testIPynb: Uri;
            let executionService: IPythonToolExecutionService;
            let editorProvider: INotebookEditorProvider;
            let fs: IFileSystem;
            const product: Product =
                formatter === 'yapf' ? Product.yapf : formatter === 'black' ? Product.black : Product.autopep8;
            suiteSetup(async () => {
                const workspaceService = api.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
                const config = workspaceService.getConfiguration(
                    'python.formatting',
                    workspaceService.workspaceFolders![0].uri
                );
                await config.update('provider', formatter, ConfigurationTarget.Workspace);
            });
            setup(async () => {
                sinon.restore();
                await initializeTest();
                await swallowSavingOfNotebooks();

                // Don't use same file (due to dirty handling, we might save in dirty.)
                // Cuz we won't save to file, hence extension will backup in dirty file and when u re-open it will open from dirty.
                const templateIPynb = path.join(
                    EXTENSION_ROOT_DIR_FOR_TESTS,
                    'src',
                    'test',
                    'datascience',
                    'notebook',
                    'test.ipynb'
                );
                testIPynb = Uri.file(await createTemporaryNotebook(templateIPynb, disposables));
                executionService = api.serviceContainer.get<IPythonToolExecutionService>(IPythonToolExecutionService);
                editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
                fs = api.serviceContainer.get<IFileSystem>(IFileSystem);
            });
            teardown(closeNotebooksAndCleanUpAfterTests);
            suiteTeardown(() => disposeAllDisposables(disposables));
            test('Formatted with temporary file when formatting existing saved notebooks (without changes)', async () => {
                // Open a new notebook & add a cell
                await editorProvider.open(testIPynb);

                // Check if a temp file is created.
                const spiedExecution = sinon.spy(executionService, 'exec');
                const spiedWriteFile = sinon.spy(fs, 'writeFile');
                disposables.push({ dispose: () => spiedWriteFile.restore() });
                disposables.push({ dispose: () => spiedExecution.restore() });

                // Format the cell
                await commands.executeCommand('notebook.formatCell');

                // Verify a temp file was created, having a file starting with thenb file name.
                assert.isOk(
                    spiedWriteFile
                        .getCalls()
                        .some(
                            (call) =>
                                call.args[0].includes(path.basename(testIPynb.fsPath)) &&
                                call.args[0].includes('.ipynb')
                        ),
                    'Temp file not created'
                );
                // Verify we tried to format.
                assert.isOk(
                    spiedExecution.getCalls().some((call) => call.args[0].product === product),
                    'Not formatted'
                );
            });
            test('Formatted with temporary file when formatting untitled notebooks', async () => {
                // Open a new notebook & add a cell
                await editorProvider.createNew();

                // Check if a temp file is created.
                const spiedExecution = sinon.spy(executionService, 'exec');
                const spiedWriteFile = sinon.spy(fs, 'writeFile');
                disposables.push({ dispose: () => spiedWriteFile.restore() });
                disposables.push({ dispose: () => spiedExecution.restore() });

                // Format the cell
                await commands.executeCommand('notebook.formatCell');

                // Verify a temp file was created, having a file starting with thenb file name.
                assert.isOk(
                    spiedWriteFile.getCalls().some((call) => call.args[0].includes('.ipynb')),
                    'Temp file not created'
                );
                // Verify we tried to format.
                assert.isOk(
                    spiedExecution.getCalls().some((call) => call.args[0].product === product),
                    'Not formatted'
                );
            });
        });
    });
});
