// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import * as sinon from 'sinon';
import { CancellationTokenSource, commands, NotebookEditor as VSCNotebookEditor } from 'vscode';
import { CellErrorOutput, CellStreamOutput } from '../../../../typings/vscode-proposed';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { IDisposable } from '../../../client/common/types';
import { createDeferredFromPromise, sleep } from '../../../client/common/utils/async';
import { INotebookExecutionService } from '../../../client/datascience/notebook/types';
import { INotebookEditorProvider } from '../../../client/datascience/types';
import { IExtensionTestApi, waitForCondition } from '../../common';
import { initialize } from '../../initialize';
import {
    assertVSCCellHasErrors,
    assertVSCCellIsIdle,
    assertVSCCellIsRunning,
    canRunTests,
    closeNotebooksAndCleanUpAfterTests,
    deleteAllCellsAndWait,
    disposeAllDisposables,
    insertPythonCellAndWait,
    startJupyter,
    swallowSavingOfNotebooks
} from './helper';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

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
    const suiteDisposables: IDisposable[] = [];
    suiteSetup(async function () {
        this.timeout(15_000);
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

        sinon.restore();
        await swallowSavingOfNotebooks();

        // Open a notebook and use this for all tests in this test suite.
        await editorProvider.createNew();
        assert.isOk(vscodeNotebook.activeNotebookEditor, 'No active notebook');
        vscEditor = vscodeNotebook.activeNotebookEditor!;
    });
    setup(deleteAllCellsAndWait);
    teardown(() => disposeAllDisposables(suiteDisposables));
    suiteTeardown(() => closeNotebooksAndCleanUpAfterTests(disposables.concat(suiteDisposables)));

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
        assertVSCCellHasErrors(cell);
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

        await waitForCondition(async () => assertVSCCellHasErrors(cell), 1_000, 'Execution not cancelled');
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

        await waitForCondition(async () => assertVSCCellHasErrors(cell), 1_000, 'Execution not cancelled');
    });
    test('When running entire notebook, clicking VSCode Stop button should trigger a single interrupt, not one per cell', async () => {
        await insertPythonCellAndWait('import time\nfor i in range(10000):\n  print(i)\n  time.sleep(0.1)', 0);
        await insertPythonCellAndWait('import time\nfor i in range(10000):\n  print(i)\n  time.sleep(0.1)', 0);
        await insertPythonCellAndWait('import time\nfor i in range(10000):\n  print(i)\n  time.sleep(0.1)', 0);
        const cell1 = vscEditor.document.cells[0];
        const cell2 = vscEditor.document.cells[1];
        const cell3 = vscEditor.document.cells[2];

        const interrupt = sinon.spy(editorProvider.activeEditor!, 'interruptKernel');
        suiteDisposables.push({ dispose: () => interrupt.restore() });

        await commands.executeCommand('notebook.execute');

        // Wait for cells to get busy.
        await waitForCondition(
            async () => assertVSCCellIsRunning(cell1) && assertVSCCellIsRunning(cell2) && assertVSCCellIsRunning(cell3),
            15_000,
            'Cells not being executed'
        );

        // Cancel execution.
        await sleep(1_000);
        await commands.executeCommand('notebook.cancelExecution');

        // Wait for ?s, and verify cells are not running.
        await waitForCondition(
            // First cell will have interrupt error and others will have just stopped even before they start.
            async () => assertVSCCellHasErrors(cell1) && assertVSCCellIsIdle(cell2) && assertVSCCellIsIdle(cell3),
            15_000,
            'Cells are still running'
        );

        assert.lengthOf(cell1.outputs, 2, 'First cell should have two outputs (stream and error)');
        assert.lengthOf(cell2.outputs, 0, 'Should not have any output');
        assert.lengthOf(cell3.outputs, 0, 'Should not have any output');

        const cell1Output1 = cell1.outputs[0] as CellStreamOutput;
        const cell1Output2 = cell1.outputs[1] as CellErrorOutput;
        assert.equal(cell1Output1.outputKind, vscodeNotebookEnums.CellOutputKind.Rich, 'Should be text output');
        assert.equal(cell1Output2.outputKind, vscodeNotebookEnums.CellOutputKind.Error, 'Should be error output');
        assert.equal(interrupt.callCount, 1, 'Interrupt should have been invoked only once');
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
        const restartPromise = commands.executeCommand('python.datascience.notebookeditor.restartkernel');

        await waitForCondition(async () => assertVSCCellIsIdle(cell), 15_000, 'Execution not cancelled');

        // Wait before we execute cells again.
        await restartPromise;
        await commands.executeCommand('notebook.execute');

        // Wait for cell to get busy.
        await waitForCondition(async () => assertVSCCellIsRunning(cell), 15_000, 'Cell not being executed');

        // Cleanup (don't leave them running).
        await commands.executeCommand('notebook.cancelExecution');

        // Wait for ?s, and verify cells are not running.
        await waitForCondition(async () => assertVSCCellHasErrors(cell), 15_000, 'Cell is still running');
    });
});
