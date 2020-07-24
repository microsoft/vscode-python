// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import * as sinon from 'sinon';
import { CancellationTokenSource, commands, NotebookEditor as VSCNotebookEditor } from 'vscode';
import { IApplicationShell, IVSCodeNotebook } from '../../../client/common/application/types';
import { IDisposable } from '../../../client/common/types';
import { createDeferredFromPromise } from '../../../client/common/utils/async';
import { INotebookExecutionService } from '../../../client/datascience/notebook/types';
import { INotebookEditorProvider } from '../../../client/datascience/types';
import { IExtensionTestApi, waitForCondition } from '../../common';
import { initialize } from '../../initialize';
import {
    assertVSCCellHasErrors,
    assertVSCCellIsNotRunning,
    assertVSCCellIsRunning,
    canRunTests,
    closeNotebooks,
    closeNotebooksAndCleanUpAfterTests,
    deleteAllCellsAndWait,
    insertPythonCellAndWait,
    startJupyter,
    waitForTextOutputInVSCode
} from './helper';
// tslint:disable-next-line: no-var-requires no-require-imports

// tslint:disable: no-any no-invalid-this
/*
 * This test focuses on interrupting, restarting kernels.
 * We will not use actual kernels, just ensure the appropriate methods are invoked on the appropriate classes.
 * This is done by stubbing out some methods.
 */
suite('DataScience - VSCode Notebook - Restart/Interrupt/Cancel/Errors (slow)', function () {
    this.timeout(60_000);

    let api: IExtensionTestApi;
    let editorProvider: INotebookEditorProvider;
    const disposables: IDisposable[] = [];
    let executionService: INotebookExecutionService;
    let vscEditor: VSCNotebookEditor;
    let vscodeNotebook: IVSCodeNotebook;
    const suiteDisposables: IDisposable[] = [];
    suiteSetup(async function () {
        this.timeout(60_000);
        api = await initialize();
        if (!(await canRunTests())) {
            return this.skip();
        }
        await closeNotebooksAndCleanUpAfterTests();
        await startJupyter();
        vscodeNotebook = api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook);
        editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
        editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
        executionService = api.serviceContainer.get<INotebookExecutionService>(INotebookExecutionService);
    });
    setup(async () => {
        sinon.restore();

        // Open a notebook and use this for all tests in this test suite.
        await editorProvider.createNew();
        assert.isOk(vscodeNotebook.activeNotebookEditor, 'No active notebook');
        vscEditor = vscodeNotebook.activeNotebookEditor!;
        await deleteAllCellsAndWait();
    });
    teardown(() => closeNotebooks(disposables));
    suiteTeardown(() => closeNotebooksAndCleanUpAfterTests(disposables.concat(suiteDisposables)));

    test('Cancelling token will cancel cell execution', async () => {
        await insertPythonCellAndWait('import time\nfor i in range(10000):\n  print(i)\n  time.sleep(0.1)', 0);
        const cancellation = new CancellationTokenSource();
        const cell = vscEditor.document.cells[0];
        const appShell = api.serviceContainer.get<IApplicationShell>(IApplicationShell);
        const showInformationMessage = sinon.stub(appShell, 'showInformationMessage');
        showInformationMessage.resolves(); // Ignore message to restart kernel.
        disposables.push({ dispose: () => showInformationMessage.restore() });

        const promise = executionService.executeCell(vscEditor.document, cell, cancellation.token);
        const deferred = createDeferredFromPromise(promise);

        // Wait for cell to get busy.
        await waitForCondition(async () => assertVSCCellIsRunning(cell), 15_000, 'Cell not being executed');

        // Wait for ?s, and verify cell is still running.
        assert.isFalse(deferred.completed);
        assertVSCCellIsRunning(cell);
        // Wait for some output.
        await waitForTextOutputInVSCode(cell, '1', 0, false, 15_000); // Wait for 15 seconds for it to start (possibly kernel is still starting).

        // Interrupt the kernel.
        cancellation.cancel();

        // Wait for interruption or message prompting to restart kernel to be displayed.
        // Interrupt can fail sometimes and then we display message prompting user to restart kernel.
        await waitForCondition(
            async () => deferred.completed || showInformationMessage.called,
            30_000, // Wait for completion or interrupt timeout.
            'Execution not cancelled'
        );
        if (deferred.completed) {
            assertVSCCellHasErrors(cell);
        }
    });
    test('Restarting kernel will cancel cell execution & we can re-run a cell', async () => {
        await insertPythonCellAndWait('import time\nfor i in range(10000):\n  print(i)\n  time.sleep(0.1)', 0);
        const cell = vscEditor.document.cells[0];

        await commands.executeCommand('notebook.execute');

        // Wait for cell to get busy.
        await waitForCondition(async () => assertVSCCellIsRunning(cell), 15_000, 'Cell not being executed');

        // Wait for ?s, and verify cell is still running.
        assertVSCCellIsRunning(cell);
        // Wait for some output.
        await waitForTextOutputInVSCode(cell, '1', 0, false, 15_000); // Wait for 15 seconds for it to start (possibly kernel is still starting).

        // Restart the kernel.
        const restartPromise = commands.executeCommand('python.datascience.notebookeditor.restartkernel');

        await waitForCondition(async () => assertVSCCellIsNotRunning(cell), 15_000, 'Execution not cancelled');

        // Wait before we execute cells again.
        await restartPromise;

        // Confirm we can execute a cell (using the new kernel session).
        await commands.executeCommand('notebook.execute');

        // Wait for cell to get busy.
        await waitForCondition(async () => assertVSCCellIsRunning(cell), 15_000, 'Cell not being executed');
    });
});
