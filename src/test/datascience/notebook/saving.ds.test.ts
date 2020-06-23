// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-require-imports no-var-requires
import { assert, expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { commands, Uri } from 'vscode';
import { NotebookCell } from '../../../../typings/vscode-proposed';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { IDisposable } from '../../../client/common/types';
import { sleep } from '../../../client/common/utils/async';
import { INotebookEditorProvider } from '../../../client/datascience/types';
import { IExtensionTestApi, waitForCondition } from '../../common';
import { closeActiveWindows, EXTENSION_ROOT_DIR_FOR_TESTS, initialize } from '../../initialize';
import {
    assertHasExecutionCompletedSuccessfully,
    assertHasExecutionCompletedWithErrors,
    assertHasTextOutputInVSCode,
    assertVSCCellHasErrorOutput,
    assertVSCCellIsIdle,
    assertVSCCellIsRunning,
    canRunTests,
    closeNotebooksAndCleanUpAfterTests,
    createTemporaryNotebook,
    insertPythonCellAndWait,
    saveActiveNotebook,
    startJupyter,
    swallowSavingOfNotebooks
} from './helper';
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

// tslint:disable: no-any no-invalid-this
suite('DataScience - VSCode Notebook - (Saving)', function () {
    this.timeout(60_000);
    const templateIPynb = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'test', 'datascience', 'empty.ipynb');
    let api: IExtensionTestApi;
    let testIPynb: Uri;
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
        // Don't use same file (due to dirty handling, we might save in dirty.)
        // Cuz we won't save to file, hence extension will backup in dirty file and when u re-open it will open from dirty.
        testIPynb = Uri.file(await createTemporaryNotebook(templateIPynb, disposables));
        await editorProvider.open(testIPynb);
    });
    teardown(async () => {
        await swallowSavingOfNotebooks();
        await closeNotebooksAndCleanUpAfterTests(disposables);
    });

    test('Verify output & metadata when re-opening (slow)', async () => {
        await insertPythonCellAndWait('import time\nfor i in range(10000):\n  print(i)\n  time.sleep(0.1)', 0);
        await insertPythonCellAndWait('import time\nfor i in range(10000):\n  print(i)\n  time.sleep(0.1)', 0);
        await insertPythonCellAndWait('print(a)', 0);
        await insertPythonCellAndWait('print(1)', 0);
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

        // Wait till 1 & 2 finish & 3rd cell starts executing.
        await waitForCondition(
            async () =>
                assertHasExecutionCompletedSuccessfully(cell1) &&
                assertHasExecutionCompletedWithErrors(cell2) &&
                assertVSCCellIsRunning(cell3) &&
                assertVSCCellIsRunning(cell4),
            15_000,
            'Cells not running'
        );

        await sleep(1); // Wait for some output.
        await commands.executeCommand('notebook.cancelExecution');

        // Wait till execution count changes and status is error.
        await waitForCondition(
            async () => assertHasExecutionCompletedWithErrors(cell3) && assertVSCCellIsIdle(cell4),
            15_000,
            'Cells not running'
        );

        function verifyCelMetadata() {
            assert.lengthOf(cell1.outputs, 1, 'Incorrect output for cell 1');
            assert.lengthOf(cell2.outputs, 1, 'Incorrect output for cell 2');
            assert.lengthOf(cell3.outputs, 2, 'Incorrect output for cell 3'); // stream and interrupt error.
            assert.lengthOf(cell4.outputs, 0, 'Incorrect output for cell 4');

            assert.equal(
                cell1.metadata.runState,
                vscodeNotebookEnums.NotebookCellRunState.Success,
                'Incorrect state 1'
            );
            assert.equal(cell2.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Error, 'Incorrect state 2');
            assert.equal(cell3.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Error, 'Incorrect state 3');
            assert.equal(cell4.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Idle, 'Incorrect state 4');

            assertHasTextOutputInVSCode(cell1, '1', 0);
            assertVSCCellHasErrorOutput(cell2);
            assertHasTextOutputInVSCode(cell3, '0', 0);
            assertVSCCellHasErrorOutput(cell3);

            expect(cell1.metadata.executionOrder).to.be.greaterThan(0, 'Execution count should be > 0');
            expect(cell2.metadata.executionOrder).to.be.greaterThan(
                cell1.metadata.executionOrder!,
                'Execution count > cell 1'
            );
            expect(cell3.metadata.executionOrder).to.be.greaterThan(
                cell2.metadata.executionOrder!,
                'Execution count > cell 2'
            );
            assert.isNotOk(cell4.metadata.executionOrder, 'Execution count should be 0|null');

            assert.isEmpty(cell1.metadata.statusMessage || '', 'Cell 1 status should be empty'); // No errors.
            assert.isNotEmpty(cell2.metadata.statusMessage, 'Cell 1 status should be empty'); // Errors.
            assert.isNotEmpty(cell3.metadata.statusMessage, 'Cell 1 status should be empty'); // Errors (interrupted).
            assert.isEmpty(cell4.metadata.statusMessage || '', 'Cell 1 status should be empty'); // No errors (didn't run).

            assert.isOk(cell1.metadata.runStartTime, 'Start time should be > 0');
            assert.isOk(cell1.metadata.lastRunDuration, 'Duration should be > 0');
            assert.isOk(cell2.metadata.runStartTime, 'Start time should be > 0');
            assert.isOk(cell2.metadata.lastRunDuration, 'Duration should be > 0');
            assert.isOk(cell3.metadata.runStartTime, 'Start time should be > 0');
            assert.isOk(cell3.metadata.lastRunDuration, 'Duration should be > 0');
            assert.isOk(cell4.metadata.runStartTime, 'Start time should be > 0');
            assert.isOk(cell4.metadata.lastRunDuration, 'Duration should be > 0');
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
