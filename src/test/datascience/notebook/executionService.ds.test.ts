// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-require-imports no-var-requires
import { assert, expect } from 'chai';
import * as dedent from 'dedent';
import * as sinon from 'sinon';
import { commands } from 'vscode';
import { CellErrorOutput } from '../../../../typings/vscode-proposed';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { IDisposable } from '../../../client/common/types';
import { INotebookEditorProvider } from '../../../client/datascience/types';
import { IExtensionTestApi, waitForCondition } from '../../common';
import { initialize } from '../../initialize';
import {
    assertHasExecutionCompletedSuccessfully,
    assertHasExecutionCompletedWithErrors,
    assertHasTextOutputInICell,
    assertHasTextOutputInVSCode,
    assertNotHasTextOutputInVSCode,
    assertVSCCellHasErrors,
    canRunTests,
    closeNotebooksAndCleanUpAfterTests,
    deleteAllCellsAndWait,
    insertPythonCellAndWait,
    startJupyter,
    swallowSavingOfNotebooks
} from './helper';

// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

// tslint:disable: no-any no-invalid-this
suite('DataScience - VSCode Notebook - (Execution) (slow)', function () {
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
        sinon.restore();
        await swallowSavingOfNotebooks();
        vscodeNotebook = api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook);
        editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);

        // Open a notebook and use this for all tests in this test suite.
        await editorProvider.createNew();
    });
    setup(deleteAllCellsAndWait);
    suiteTeardown(() => closeNotebooksAndCleanUpAfterTests(disposables));

    test('Execute cell using VSCode Command', async () => {
        await insertPythonCellAndWait('print("Hello World")', 0);
        const vscCell = vscodeNotebook.activeNotebookEditor?.document.cells!;

        await commands.executeCommand('notebook.cell.execute');

        // Wait till execution count changes and status is success.
        await waitForCondition(
            async () => assertHasExecutionCompletedSuccessfully(vscCell[0]),
            15_000,
            'Cell did not get executed'
        );
    });
    test('Verify Cell output, execution count and status', async () => {
        await insertPythonCellAndWait('print("Hello World")', 0);
        const vscCell = vscodeNotebook.activeNotebookEditor?.document.cells!;
        const cellModels = editorProvider.activeEditor?.model?.cells!;

        editorProvider.activeEditor!.runAllCells();

        // Wait till execution count changes and status is success.
        await waitForCondition(
            async () => assertHasExecutionCompletedSuccessfully(vscCell[0]),
            15_000,
            'Cell did not get executed'
        );

        // Verify output.
        assertHasTextOutputInVSCode(vscCell[0], 'Hello World', 0);
        assertHasTextOutputInICell(cellModels[0], 'Hello World', 0);

        // Verify execution count.
        const execCount = cellModels[0].data.execution_count;
        assert.ok(execCount, 'Execution count should be > 0');
        assert.equal(execCount, vscCell[0].metadata.executionOrder, 'Execution count should be the same');
    });
    test('Verify multiple cells get executed', async () => {
        await insertPythonCellAndWait('print("Foo Bar")', 0);
        await insertPythonCellAndWait('print("Hello World")', 1);
        const vscCell = vscodeNotebook.activeNotebookEditor?.document.cells!;
        const cellModels = editorProvider.activeEditor?.model?.cells!;

        editorProvider.activeEditor!.runAllCells();

        // Wait till execution count changes and status is success.
        await waitForCondition(
            async () =>
                assertHasExecutionCompletedSuccessfully(vscCell[0]) &&
                assertHasExecutionCompletedSuccessfully(vscCell[1]),
            15_000,
            'Cells did not get executed'
        );

        // Verify output.
        assertHasTextOutputInVSCode(vscCell[0], 'Foo Bar', 0);
        assertHasTextOutputInICell(cellModels[0], 'Foo Bar', 0);
        assertHasTextOutputInVSCode(vscCell[1], 'Hello World', 0);
        assertHasTextOutputInICell(cellModels[1], 'Hello World', 0);

        // Verify execution count.
        assert.ok(vscCell[0].metadata.executionOrder, 'Execution count should be > 0');
        assert.equal(vscCell[1].metadata.executionOrder! - 1, vscCell[0].metadata.executionOrder!);
    });
    test('Verify metadata for successfully executed cell', async () => {
        await insertPythonCellAndWait('print("Foo Bar")', 0);
        const cell = vscodeNotebook.activeNotebookEditor?.document.cells![0]!;

        await commands.executeCommand('notebook.execute');

        // Wait till execution count changes and status is success.
        await waitForCondition(
            async () => assertHasExecutionCompletedSuccessfully(cell),
            15_000,
            'Cell did not get executed'
        );

        expect(cell.metadata.executionOrder).to.be.greaterThan(0, 'Execution count should be > 0');
        expect(cell.metadata.runStartTime).to.be.greaterThan(0, 'Start time should be > 0');
        expect(cell.metadata.lastRunDuration).to.be.greaterThan(0, 'Duration should be > 0');
        assert.equal(cell.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Success, 'Incorrect State');
        assert.equal(cell.metadata.statusMessage, '', 'Incorrect Status message');
    });
    test('Verify output & metadata for executed cell with errors', async () => {
        await insertPythonCellAndWait('print(abcd)', 0);
        const cell = vscodeNotebook.activeNotebookEditor?.document.cells![0]!;

        await commands.executeCommand('notebook.execute');

        // Wait till execution count changes and status is error.
        await waitForCondition(
            async () => assertHasExecutionCompletedWithErrors(cell),
            15_000,
            'Cell did not get executed'
        );

        assert.lengthOf(cell.outputs, 1, 'Incorrect output');
        const errorOutput = cell.outputs[0] as CellErrorOutput;
        assert.equal(errorOutput.outputKind, vscodeNotebookEnums.CellOutputKind.Error, 'Incorrect output');
        assert.isEmpty(errorOutput.ename, 'Incorrect ename'); // As status contains ename, we don't want this displayed again.
        assert.isEmpty(errorOutput.evalue, 'Incorrect evalue'); // As status contains ename, we don't want this displayed again.
        assert.isNotEmpty(errorOutput.traceback, 'Incorrect traceback');
        expect(cell.metadata.executionOrder).to.be.greaterThan(0, 'Execution count should be > 0');
        expect(cell.metadata.runStartTime).to.be.greaterThan(0, 'Start time should be > 0');
        expect(cell.metadata.lastRunDuration).to.be.greaterThan(0, 'Duration should be > 0');
        assert.equal(cell.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Error, 'Incorrect State');
        assert.include(cell.metadata.statusMessage!, 'NameError', 'Must contain error message');
        assert.include(cell.metadata.statusMessage!, 'abcd', 'Must contain error message');
    });
    test('Clearing output while executing will ensure output is cleared', async () => {
        // Assume you are executing a cell that prints numbers 1-100.
        // When printing number 50, you click clear.
        // Cell output should now start printing output from 51 onwards, & not 1.
        await insertPythonCellAndWait(
            dedent`
                    print("Start")
                    import time
                    for i in range(100):
                        time.sleep(0.1)
                        print(i)

                    print("End")`,
            0
        );
        const cell = vscodeNotebook.activeNotebookEditor?.document.cells![0]!;

        await commands.executeCommand('notebook.execute');

        // Wait till execution count changes and status is error.
        await waitForCondition(
            async () => assertHasTextOutputInVSCode(cell, 'Start', 0, false),
            15_000,
            'Cell did not get executed'
        );

        // Clear the cells
        await commands.executeCommand('notebook.clearAllCellsOutputs');
        // Wait till execution count changes and status is error.
        await waitForCondition(
            async () => assertNotHasTextOutputInVSCode(cell, 'Start', 0, false),
            5_000,
            'Cell did not get cleared'
        );

        // Interrupt the kernel).
        await commands.executeCommand('notebook.cancelExecution');
        await waitForCondition(async () => assertVSCCellHasErrors(cell), 1_000, 'Execution not cancelled');

        // Verify that it hasn't got added (even after interrupting).
        assertNotHasTextOutputInVSCode(cell, 'Start', 0, false);
    });
    test('Clearing output when not executing', async () => {
        await insertPythonCellAndWait('print("Foo Bar")', 0);
        await insertPythonCellAndWait('print("Hello World")', 1);

        const vscCells = vscodeNotebook.activeNotebookEditor?.document.cells!;
        const cellModels = editorProvider.activeEditor?.model?.cells!;

        await commands.executeCommand('notebook.execute');

        // Wait till execution count changes and status is error.
        await waitForCondition(
            async () =>
                assertHasExecutionCompletedSuccessfully(vscCells[0]) &&
                assertHasExecutionCompletedSuccessfully(vscCells[1]),
            15_000,
            'Cells did not get executed'
        );
        assert.lengthOf(vscCells[0].outputs, 1, 'Must have output');
        assert.lengthOf(vscCells[1].outputs, 1, 'Must have output');
        assert.lengthOf((cellModels[0].data.outputs as unknown) as [], 1, 'Must have output');
        assert.lengthOf((cellModels[1].data.outputs as unknown) as [], 1, 'Must have output');

        // Clear the cells
        await commands.executeCommand('notebook.clearAllCellsOutputs');

        // Wait till execution count changes and status is error.
        await waitForCondition(
            async () =>
                vscCells[0].outputs.length === 0 &&
                vscCells[1].outputs.length === 0 &&
                ((cellModels[0].data.outputs as unknown) as []).length === 0 &&
                ((cellModels[1].data.outputs as unknown) as []).length === 0,
            5_000,
            'Cell did not get cleared'
        );
    });
});
