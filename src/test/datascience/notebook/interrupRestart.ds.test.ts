// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import * as sinon from 'sinon';
import { CancellationTokenSource, commands, NotebookEditor as VSCNotebookEditor } from 'vscode';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { IDisposable } from '../../../client/common/types';
import { createDeferredFromPromise, sleep } from '../../../client/common/utils/async';
import { INotebookExecutionService } from '../../../client/datascience/notebook/types';
import { INotebookEditorProvider } from '../../../client/datascience/types';
import { IExtensionTestApi, waitForCondition } from '../../common';
import { initialize } from '../../initialize';
import {
    assertVSCCellIsIdle,
    assertVSCCellIsRunning,
    canRunTests,
    closeNotebooksAndCleanUpAfterTests,
    deleteAllCellsAndWait,
    insertPythonCellAndWait,
    startJupyter,
    swallowSavingOfNotebooks
} from './helper';

// tslint:disable: no-any no-invalid-this
/*
 * This test focuses on interrupting, restarting kernels.
 * We will not use actual kernels, just ensure the appropriate methods are invoked on the appropriate classes.
 * This is done by stubbing out some methods.
 */
suite('DataScience - VSCode Notebook - Restart/Interrupt/Cancel/Errors', function () {
    this.timeout(15_000);

    let api: IExtensionTestApi;
    let editorProvider: INotebookEditorProvider;
    const disposables: IDisposable[] = [];
    let executionService: INotebookExecutionService;
    let vscEditor: VSCNotebookEditor;
    let vscodeNotebook: IVSCodeNotebook;
    suiteSetup(async function () {
        this.timeout(15_000);
        api = await initialize();
        if (!(await canRunTests())) {
            return this.skip();
        }
        await startJupyter();
        vscodeNotebook = api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook);
        editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
        editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
        executionService = api.serviceContainer.get<INotebookExecutionService>(INotebookExecutionService);

        sinon.restore();
        await swallowSavingOfNotebooks();

        // Open a notebook and use this for all tests in this test suite.
        await editorProvider.createNew();
        assert.isOk(vscodeNotebook.activeNotebookEditor, 'No active notebook');
        vscEditor = vscodeNotebook.activeNotebookEditor!;
    });
    setup(deleteAllCellsAndWait);
    suiteTeardown(() => closeNotebooksAndCleanUpAfterTests(disposables));

    test('Cancelling token will cancel cell execution (slow)', async () => {
        await insertPythonCellAndWait('import time\nfor i in range(10000):\n  print(i)\n  time.sleep(0.1)', 0);
        const cancellation = new CancellationTokenSource();
        const cell = vscEditor.document.cells[0];

        const promise = executionService.executeCell(vscEditor.document, cell, cancellation.token);
        const deferred = createDeferredFromPromise(promise);

        // Wait for cell to get busy.
        await waitForCondition(async () => assertVSCCellIsRunning(cell), 15_000, 'Cell not being executed');

        // Wait for ?s, and verify cell is still running.
        await sleep(1_000);
        assert.isFalse(deferred.completed);
        assertVSCCellIsRunning(cell);

        // Interrupt the kernel.
        cancellation.cancel();

        await waitForCondition(async () => deferred.completed, 5_000, 'Execution not cancelled');
        assertVSCCellIsIdle(cell);
    });
    test('Cancelling using VSC Command for cell (slow)', async function () {
        // Fails due to VSC bugs.
        return this.skip();
        await insertPythonCellAndWait('import time\nfor i in range(10000):\n  print(i)\n  time.sleep(0.1)', 0);
        const cell = vscEditor.document.cells[0];

        await commands.executeCommand('notebook.cell.execute', cell);

        // Wait for cell to get busy.
        await waitForCondition(async () => assertVSCCellIsRunning(cell), 15_000, 'Cell not being executed');

        // Wait for ?s, and verify cell is still running.
        await sleep(1_000);
        assertVSCCellIsRunning(cell);

        // Interrupt the kernel.
        await commands.executeCommand('notebook.cell.cancelExecution', cell);

        await waitForCondition(async () => assertVSCCellIsIdle(cell), 1_000, 'Execution not cancelled');
    });
    test('Cancelling using VSC Command in toolbar (slow)', async () => {
        await insertPythonCellAndWait('import time\nfor i in range(10000):\n  print(i)\n  time.sleep(0.1)', 0);
        const cell = vscEditor.document.cells[0];

        await commands.executeCommand('notebook.execute');

        // Wait for cell to get busy.
        await waitForCondition(async () => assertVSCCellIsRunning(cell), 15_000, 'Cell not being executed');

        // Wait for ?s, and verify cell is still running.
        await sleep(1_000);
        assertVSCCellIsRunning(cell);

        // Interrupt the kernel.
        await commands.executeCommand('notebook.cancelExecution');

        await waitForCondition(async () => assertVSCCellIsIdle(cell), 1_000, 'Execution not cancelled');
    });
    test('Restarting kernel will cancel cell execution (slow)', async () => {
        await insertPythonCellAndWait('import time\nfor i in range(10000):\n  print(i)\n  time.sleep(0.1)', 0);
        const cell = vscEditor.document.cells[0];

        await commands.executeCommand('notebook.execute');

        // Wait for cell to get busy.
        await waitForCondition(async () => assertVSCCellIsRunning(cell), 15_000, 'Cell not being executed');

        // Wait for ?s, and verify cell is still running.
        await sleep(1_000);
        assertVSCCellIsRunning(cell);

        // Restart the kernel.
        await commands.executeCommand('python.datascience.notebookeditor.restartkernel');

        await waitForCondition(async () => assertVSCCellIsIdle(cell), 1_000, 'Execution not cancelled');
    });
});
