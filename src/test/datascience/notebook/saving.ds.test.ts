// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-require-imports no-var-requires
import { nbformat } from '@jupyterlab/coreutils/lib/nbformat';
import { assert, expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as sinon from 'sinon';
import { commands, Uri } from 'vscode';
import { NotebookCell } from '../../../../typings/vscode-proposed';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { IDisposable } from '../../../client/common/types';
import { sleep } from '../../../client/common/utils/async';
import { INotebookContentProvider } from '../../../client/datascience/notebook/types';
import { INotebookEditorProvider } from '../../../client/datascience/types';
import { createEventHandler, IExtensionTestApi, waitForCondition } from '../../common';
import { closeActiveWindows, EXTENSION_ROOT_DIR_FOR_TESTS, initialize } from '../../initialize';
import {
    assertHasExecutionCompletedSuccessfully,
    assertHasExecutionCompletedWithErrors,
    assertHasTextOutputInVSCode,
    assertVSCCellHasErrorOutput,
    assertVSCCellStateIsUndefined,
    canRunTests,
    closeNotebooksAndCleanUpAfterTests,
    createTemporaryNotebook,
    insertPythonCellAndWait,
    saveActiveNotebook,
    startJupyter,
    swallowSavingOfNotebooks
} from './helper';
// tslint:disable-next-line:no-require-imports no-var-requires
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

// tslint:disable: no-any no-invalid-this
suite('DataScience - VSCode Notebook - (Saving)', function () {
    this.timeout(60_000);
    let api: IExtensionTestApi;
    let editorProvider: INotebookEditorProvider;
    const disposables: IDisposable[] = [];
    let vscodeNotebook: IVSCodeNotebook;
    suiteSetup(async function () {
        this.timeout(60_000);
        api = await initialize();
        if (!(await canRunTests())) {
            return this.skip();
        }
        await startJupyter();
        vscodeNotebook = api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook);
        editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
    });
    setup(async () => {
        sinon.restore();
    });
    teardown(async () => {
        await swallowSavingOfNotebooks();
        await closeNotebooksAndCleanUpAfterTests(disposables);
    });
    test('Clearing output will mark document as dirty', async () => {
        const templateIPynb = path.join(
            EXTENSION_ROOT_DIR_FOR_TESTS,
            'src',
            'test',
            'datascience',
            'notebook',
            'test.ipynb'
        );
        // Don't use same file (due to dirty handling, we might save in dirty.)
        // Cuz we won't save to file, hence extension will backup in dirty file and when u re-open it will open from dirty.
        const testIPynb = Uri.file(await createTemporaryNotebook(templateIPynb, disposables));
        await editorProvider.open(testIPynb);
        const contentProvider = api.serviceContainer.get<INotebookContentProvider>(INotebookContentProvider);
        const changedEvent = createEventHandler(contentProvider, 'onDidChangeNotebook', disposables);

        // Clear the output & then save the notebook.
        await commands.executeCommand('notebook.clearAllCellsOutputs');

        // Wait till execution count changes & it is marked as dirty
        await changedEvent.assertFired(5000);
    });
    test('Saving after clearing should result in execution_count=null in ipynb file', async () => {
        const templateIPynb = path.join(
            EXTENSION_ROOT_DIR_FOR_TESTS,
            'src',
            'test',
            'datascience',
            'notebook',
            'test.ipynb'
        );
        // Don't use same file (due to dirty handling, we might save in dirty.)
        // Cuz we won't save to file, hence extension will backup in dirty file and when u re-open it will open from dirty.
        const testIPynb = Uri.file(await createTemporaryNotebook(templateIPynb, disposables));
        await editorProvider.open(testIPynb);
        const notebookDocument = vscodeNotebook.activeNotebookEditor?.document!;
        const vscCells = notebookDocument.cells!;
        const contentProvider = api.serviceContainer.get<INotebookContentProvider>(INotebookContentProvider);
        const changedEvent = createEventHandler(contentProvider, 'onDidChangeNotebook', disposables);

        // Clear the output & then save the notebook.
        await commands.executeCommand('notebook.clearAllCellsOutputs');

        // Wait till execution count changes & it is marked as dirty
        await waitForCondition(
            async () => !vscCells[0].metadata.executionOrder && changedEvent.fired,
            5_000,
            'Cell did not get cleared'
        );

        await saveActiveNotebook(disposables);

        // Open nb json and validate execution_count = null.
        const json = JSON.parse(fs.readFileSync(testIPynb.fsPath, { encoding: 'utf8' })) as nbformat.INotebookContent;
        assert.ok(json.cells[0].execution_count === null);
    });
    test('Verify output & metadata when re-opening (slow)', async () => {
        const templateIPynb = path.join(
            EXTENSION_ROOT_DIR_FOR_TESTS,
            'src',
            'test',
            'datascience',
            'notebook',
            'empty.ipynb'
        );
        // Don't use same file (due to dirty handling, we might save in dirty.)
        // Cuz we won't save to file, hence extension will backup in dirty file and when u re-open it will open from dirty.
        const testIPynb = Uri.file(await createTemporaryNotebook(templateIPynb, disposables));
        await editorProvider.open(testIPynb);

        await insertPythonCellAndWait('print(1)', 0);
        await insertPythonCellAndWait('print(a)', 1);
        await insertPythonCellAndWait('import time\nfor i in range(10000):\n  print(i)\n  time.sleep(0.1)', 2);
        await insertPythonCellAndWait('import time\nfor i in range(10000):\n  print(i)\n  time.sleep(0.1)', 3);
        let cell1: NotebookCell;
        let cell2: NotebookCell;
        let cell3: NotebookCell;
        let cell4: NotebookCell;

        function initializeCells() {
            cell1 = vscodeNotebook.activeNotebookEditor?.document.cells![0]!;
            cell2 = vscodeNotebook.activeNotebookEditor?.document.cells![1]!;
            cell3 = vscodeNotebook.activeNotebookEditor?.document.cells![2]!;
            cell4 = vscodeNotebook.activeNotebookEditor?.document.cells![3]!;
        }
        initializeCells();
        await commands.executeCommand('notebook.execute');
        await sleep(5_000);
        // Wait till 1 & 2 finish & 3rd cell starts executing.
        await waitForCondition(
            async () =>
                assertHasExecutionCompletedSuccessfully(cell1) &&
                assertHasExecutionCompletedWithErrors(cell2) &&
                assertVSCCellStateIsUndefined(cell3) &&
                assertVSCCellStateIsUndefined(cell4),
            15_000,
            'Cells did not finish executing'
        );

        function verifyCelMetadata() {
            assert.lengthOf(cell1.outputs, 1, 'Incorrect output for cell 1');
            assert.lengthOf(cell2.outputs, 1, 'Incorrect output for cell 2');
            assert.lengthOf(cell3.outputs, 0, 'Incorrect output for cell 3'); // stream and interrupt error.
            assert.lengthOf(cell4.outputs, 0, 'Incorrect output for cell 4');

            assert.equal(
                cell1.metadata.runState,
                vscodeNotebookEnums.NotebookCellRunState.Success,
                'Incorrect state 1'
            );
            assert.equal(cell2.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Error, 'Incorrect state 2');
            assert.equal(
                cell3.metadata.runState || vscodeNotebookEnums.NotebookCellRunState.Idle,
                vscodeNotebookEnums.NotebookCellRunState.Idle,
                'Incorrect state 3'
            );
            assert.equal(
                cell4.metadata.runState || vscodeNotebookEnums.NotebookCellRunState.Idle,
                vscodeNotebookEnums.NotebookCellRunState.Idle,
                'Incorrect state 4'
            );

            assertHasTextOutputInVSCode(cell1, '1', 0);
            assertVSCCellHasErrorOutput(cell2);

            expect(cell1.metadata.executionOrder).to.be.greaterThan(0, 'Execution count should be > 0');
            expect(cell2.metadata.executionOrder).to.be.greaterThan(
                cell1.metadata.executionOrder!,
                'Execution count > cell 1'
            );
            assert.isUndefined(cell3.metadata.executionOrder, 'Execution count must be undefined for cell 3');
            assert.isUndefined(cell4.metadata.executionOrder, 'Execution count must be undefined for cell 4');

            assert.isEmpty(cell1.metadata.statusMessage || '', 'Cell 1 status should be empty'); // No errors.
            assert.isNotEmpty(cell2.metadata.statusMessage, 'Cell 1 status should be empty'); // Errors.
            assert.isEmpty(cell3.metadata.statusMessage || '', 'Cell 3 status should be empty'); // Not executed.
            assert.isEmpty(cell4.metadata.statusMessage || '', 'Cell 4 status should be empty'); // Not executed.

            assert.isOk(cell1.metadata.runStartTime, 'Start time should be > 0');
            assert.isOk(cell1.metadata.lastRunDuration, 'Duration should be > 0');
            assert.isOk(cell2.metadata.runStartTime, 'Start time should be > 0');
            assert.isOk(cell2.metadata.lastRunDuration, 'Duration should be > 0');
            assert.isUndefined(cell3.metadata.runStartTime, 'Cell 3 did should not have run');
            assert.isUndefined(cell3.metadata.lastRunDuration, 'Cell 3 did should not have run');
            assert.isUndefined(cell4.metadata.runStartTime, 'Cell 4 did should not have run');
            assert.isUndefined(cell4.metadata.lastRunDuration, 'Cell 4 did should not have run');
        }

        verifyCelMetadata();

        // Save and close this nb.
        await saveActiveNotebook(disposables);
        await closeActiveWindows();

        // Reopen the notebook & validate the metadata.
        await editorProvider.open(testIPynb);
        initializeCells();
        verifyCelMetadata();
    });
});
