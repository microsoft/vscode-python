// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-require-imports no-var-requires
import { assert, expect } from 'chai';
import * as dedent from 'dedent';
import * as sinon from 'sinon';
import { CellDisplayOutput, commands } from 'vscode';
import { CellErrorOutput } from '../../../../typings/vscode-proposed';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { IDisposable } from '../../../client/common/types';
import { INotebookEditorProvider } from '../../../client/datascience/types';
import { createEventHandler, IExtensionTestApi, sleep, waitForCondition } from '../../common';
import { initialize } from '../../initialize';
import {
    assertHasExecutionCompletedSuccessfully,
    assertHasExecutionCompletedWithErrors,
    assertHasTextOutputInVSCode,
    assertNotHasTextOutputInVSCode,
    assertVSCCellHasErrors,
    canRunTests,
    closeNotebooksAndCleanUpAfterTests,
    deleteAllCellsAndWait,
    executeActiveDocument,
    executeCell,
    insertPythonCell,
    startJupyter,
    trustAllNotebooks
} from './helper';

// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

// tslint:disable: no-any no-invalid-this
suite('DataScience - VSCode Notebook - (Execution) (slow)', function () {
    this.timeout(120_000);

    let api: IExtensionTestApi;
    let editorProvider: INotebookEditorProvider;
    const disposables: IDisposable[] = [];
    let vscodeNotebook: IVSCodeNotebook;
    suiteSetup(async function () {
        this.timeout(120_000);
        api = await initialize();
        if (!(await canRunTests())) {
            return this.skip();
        }
        await trustAllNotebooks();
        await startJupyter(false); // This should create a new notebook
        sinon.restore();
        vscodeNotebook = api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook);
        editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
    });
    setup(deleteAllCellsAndWait);
    suiteTeardown(() => closeNotebooksAndCleanUpAfterTests(disposables));
    test('Execute cell using VSCode Kernel', async () => {
        await insertPythonCell('print("Hello World")');
        const cell = vscodeNotebook.activeNotebookEditor?.document.cells![0]!;

        await executeCell(cell);

        // Wait till execution count changes and status is success.
        await waitForCondition(
            async () => assertHasExecutionCompletedSuccessfully(cell),
            15_000,
            'Cell did not get executed'
        );
    });
    test('Executed events are triggered', async () => {
        await insertPythonCell('print("Hello World")');
        const cell = vscodeNotebook.activeNotebookEditor?.document.cells![0]!;

        const executed = createEventHandler(editorProvider.activeEditor!, 'executed', disposables);
        const codeExecuted = createEventHandler(editorProvider.activeEditor!, 'executed', disposables);
        await executeCell(cell);

        // Wait till execution count changes and status is success.
        await waitForCondition(
            async () => assertHasExecutionCompletedSuccessfully(cell),
            15_000,
            'Cell did not get executed'
        );

        await executed.assertFired(1_000);
        await codeExecuted.assertFired(1_000);
    });
    test('Empty cell will not get executed', async () => {
        await insertPythonCell('');
        const cell = vscodeNotebook.activeNotebookEditor?.document.cells![0]!;
        await executeCell(cell);

        // After 2s, confirm status has remained unchanged.
        await sleep(2_000);
        assert.isUndefined(cell?.metadata.runState);
    });
    test('Empty cells will not get executed when running whole document', async () => {
        await insertPythonCell('');
        await insertPythonCell('print("Hello World")');
        const cells = vscodeNotebook.activeNotebookEditor?.document.cells!;

        await executeActiveDocument();

        // Wait till execution count changes and status is success.
        await waitForCondition(
            async () => assertHasExecutionCompletedSuccessfully(cells[1]),
            15_000,
            'Cell did not get executed'
        );
        assert.isUndefined(cells[0].metadata.runState);
    });
    test('Verify Cell output, execution count and status', async () => {
        await insertPythonCell('print("Hello World")');
        const cell = vscodeNotebook.activeNotebookEditor?.document.cells![0]!;

        await executeActiveDocument();

        // Wait till execution count changes and status is success.
        await waitForCondition(
            async () => assertHasExecutionCompletedSuccessfully(cell),
            15_000,
            'Cell did not get executed'
        );

        // Verify output.
        assertHasTextOutputInVSCode(cell, 'Hello World', 0);

        // Verify execution count.
        assert.ok(cell.metadata.executionOrder, 'Execution count should be > 0');
    });
    test('Verify multiple cells get executed', async () => {
        await insertPythonCell('print("Foo Bar")');
        await insertPythonCell('print("Hello World")');
        const cells = vscodeNotebook.activeNotebookEditor?.document.cells!;

        await executeActiveDocument();

        // Wait till execution count changes and status is success.
        await waitForCondition(
            async () =>
                assertHasExecutionCompletedSuccessfully(cells[0]) && assertHasExecutionCompletedSuccessfully(cells[1]),
            15_000,
            'Cells did not get executed'
        );

        // Verify output.
        assertHasTextOutputInVSCode(cells[0], 'Foo Bar');
        assertHasTextOutputInVSCode(cells[1], 'Hello World');

        // Verify execution count.
        assert.ok(cells[0].metadata.executionOrder, 'Execution count should be > 0');
        assert.equal(cells[1].metadata.executionOrder! - 1, cells[0].metadata.executionOrder!);
    });
    test('Verify metadata for successfully executed cell', async () => {
        await insertPythonCell('print("Foo Bar")');
        const cell = vscodeNotebook.activeNotebookEditor?.document.cells![0]!;

        await executeActiveDocument();

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
        await insertPythonCell('print(abcd)');
        const cell = vscodeNotebook.activeNotebookEditor?.document.cells![0]!;

        await executeActiveDocument();

        // Wait till execution count changes and status is error.
        await waitForCondition(
            async () => assertHasExecutionCompletedWithErrors(cell),
            15_000,
            'Cell did not get executed'
        );

        assert.lengthOf(cell.outputs, 1, 'Incorrect output');
        const errorOutput = cell.outputs[0] as CellErrorOutput;
        assert.equal(errorOutput.outputKind, vscodeNotebookEnums.CellOutputKind.Error, 'Incorrect output');
        assert.equal(errorOutput.ename, 'NameError', 'Incorrect ename'); // As status contains ename, we don't want this displayed again.
        assert.equal(errorOutput.evalue, "name 'abcd' is not defined", 'Incorrect evalue'); // As status contains ename, we don't want this displayed again.
        assert.isNotEmpty(errorOutput.traceback, 'Incorrect traceback');
        expect(cell.metadata.executionOrder).to.be.greaterThan(0, 'Execution count should be > 0');
        expect(cell.metadata.runStartTime).to.be.greaterThan(0, 'Start time should be > 0');
        expect(cell.metadata.lastRunDuration).to.be.greaterThan(0, 'Duration should be > 0');
        assert.equal(cell.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Error, 'Incorrect State');
        assert.include(cell.metadata.statusMessage!, 'NameError', 'Must contain error message');
        assert.include(cell.metadata.statusMessage!, 'abcd', 'Must contain error message');
    });
    test('Updating display data', async () => {
        await insertPythonCell('from IPython.display import Markdown\n');
        await insertPythonCell('dh = display(display_id=True)\n');
        await insertPythonCell('dh.update(Markdown("foo"))\n');
        const displayCell = vscodeNotebook.activeNotebookEditor?.document.cells![1]!;
        const updateCell = vscodeNotebook.activeNotebookEditor?.document.cells![2]!;

        await executeActiveDocument();

        // Wait till execution count changes and status is success.
        await waitForCondition(
            async () => assertHasExecutionCompletedSuccessfully(updateCell),
            15_000,
            'Cell did not get executed'
        );

        assert.lengthOf(displayCell.outputs, 1, 'Incorrect output');
        const markdownOutput = displayCell.outputs[0] as CellDisplayOutput;
        assert.equal(markdownOutput.outputKind, vscodeNotebookEnums.CellOutputKind.Rich, 'Incorrect output');
        expect(displayCell.metadata.executionOrder).to.be.greaterThan(0, 'Execution count should be > 0');
        expect(displayCell.metadata.runStartTime).to.be.greaterThan(0, 'Start time should be > 0');
        expect(displayCell.metadata.lastRunDuration).to.be.greaterThan(0, 'Duration should be > 0');
        expect(markdownOutput.data['text/markdown']).to.be.equal('foo', 'Display cell did not update');
    });
    test('Clearing output while executing will ensure output is cleared', async () => {
        // Assume you are executing a cell that prints numbers 1-100.
        // When printing number 50, you click clear.
        // Cell output should now start printing output from 51 onwards, & not 1.
        await insertPythonCell(
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

        await executeActiveDocument();

        // Wait till we get the desired output.
        await waitForCondition(
            async () =>
                assertHasTextOutputInVSCode(cell, 'Start', 0, false) &&
                assertHasTextOutputInVSCode(cell, '0', 0, false) &&
                assertHasTextOutputInVSCode(cell, '1', 0, false) &&
                assertHasTextOutputInVSCode(cell, '2', 0, false) &&
                assertHasTextOutputInVSCode(cell, '3', 0, false) &&
                assertHasTextOutputInVSCode(cell, '4', 0, false),
            15_000,
            'Cell did not get executed'
        );

        // Clear the cells
        await commands.executeCommand('notebook.clearAllCellsOutputs');

        // Wait till previous output gets cleared & we have new output.
        await waitForCondition(
            async () =>
                assertNotHasTextOutputInVSCode(cell, 'Start', 0, false) &&
                cell.outputs.length > 0 &&
                cell.outputs[0].outputKind === vscodeNotebookEnums.CellOutputKind.Rich,
            5_000,
            'Cell did not get cleared'
        );

        // Interrupt the kernel).
        await commands.executeCommand('notebook.cancelExecution');
        await waitForCondition(async () => assertVSCCellHasErrors(cell), 1_000, 'Execution not cancelled');

        // Verify that it hasn't got added (even after interrupting).
        assertNotHasTextOutputInVSCode(cell, 'Start', 0, false);
    });
    test('Clearing output via code', async () => {
        // Assume you are executing a cell that prints numbers 1-100.
        // When printing number 50, you click clear.
        // Cell output should now start printing output from 51 onwards, & not 1.
        await insertPythonCell(
            dedent`
                from IPython.display import display, clear_output
                import time
                print('foo')
                display('foo')
                time.sleep(2)
                clear_output(True)
                print('bar')
                display('bar')`,
            0
        );
        const cell = vscodeNotebook.activeNotebookEditor?.document.cells![0]!;

        await executeActiveDocument();

        // Wait for foo to be printed
        await waitForCondition(
            async () =>
                assertHasTextOutputInVSCode(cell, 'foo', 0, false) &&
                assertHasTextOutputInVSCode(cell, 'foo', 1, false),
            15_000,
            'Incorrect output'
        );

        // Wait for bar to be printed
        await waitForCondition(
            async () =>
                assertHasTextOutputInVSCode(cell, 'bar', 0, false) &&
                assertHasTextOutputInVSCode(cell, 'bar', 1, false),
            15_000,
            'Incorrect output'
        );
    });
    test('Testing streamed output', async () => {
        // Assume you are executing a cell that prints numbers 1-100.
        // When printing number 50, you click clear.
        // Cell output should now start printing output from 51 onwards, & not 1.
        await insertPythonCell(
            dedent`
                    print("Start")
                    import time
                    for i in range(5):
                        time.sleep(0.5)
                        print(i)

                    print("End")`,
            0
        );
        const cell = vscodeNotebook.activeNotebookEditor?.document.cells![0]!;

        await executeActiveDocument();

        await waitForCondition(
            async () =>
                assertHasTextOutputInVSCode(cell, 'Start', 0, false) &&
                assertHasTextOutputInVSCode(cell, '0', 0, false) &&
                assertHasTextOutputInVSCode(cell, '1', 0, false) &&
                assertHasTextOutputInVSCode(cell, '2', 0, false) &&
                assertHasTextOutputInVSCode(cell, '3', 0, false) &&
                assertHasTextOutputInVSCode(cell, '4', 0, false) &&
                assertHasTextOutputInVSCode(cell, 'End', 0, false),
            15_000,
            'Incorrect output'
        );
    });
    test('Verify escaping of output', async () => {
        await insertPythonCell('1');
        await insertPythonCell(dedent`
                                            a="<a href=f>"
                                            a`);
        await insertPythonCell(dedent`
                                            a="<a href=f>"
                                            print(a)`);
        await insertPythonCell('raise Exception("<whatever>")');
        const cells = vscodeNotebook.activeNotebookEditor?.document.cells!;

        await executeActiveDocument();

        // Wait till execution count changes and status is error.
        await waitForCondition(
            async () => assertHasExecutionCompletedWithErrors(cells[3]),
            15_000,
            'Cell did not get executed'
        );

        for (const cell of cells) {
            assert.lengthOf(cell.outputs, 1, 'Incorrect output');
        }
        assert.equal(
            cells[0].outputs[0].outputKind,
            vscodeNotebookEnums.CellOutputKind.Rich,
            'Incorrect output for first cell'
        );
        assert.equal(
            cells[1].outputs[0].outputKind,
            vscodeNotebookEnums.CellOutputKind.Rich,
            'Incorrect output for first cell'
        );
        assert.equal(
            cells[2].outputs[0].outputKind,
            vscodeNotebookEnums.CellOutputKind.Rich,
            'Incorrect output for first cell'
        );
        assertHasTextOutputInVSCode(cells[0], '1');
        assertHasTextOutputInVSCode(cells[1], '<a href=f>', 0, false);
        assertHasTextOutputInVSCode(cells[2], '<a href=f>', 0, false);
        const errorOutput = cells[3].outputs[0] as CellErrorOutput;
        assert.equal(errorOutput.outputKind, vscodeNotebookEnums.CellOutputKind.Error, 'Incorrect output');
        assert.equal(errorOutput.ename, 'Exception', 'Incorrect ename'); // As status contains ename, we don't want this displayed again.
        assert.equal(errorOutput.evalue, '<whatever>', 'Incorrect evalue'); // As status contains ename, we don't want this displayed again.
        assert.isNotEmpty(errorOutput.traceback, 'Incorrect traceback');
        assert.include(errorOutput.traceback.join(''), '<whatever>');
    });
    test('Verify display updates', async () => {
        await insertPythonCell('from IPython.display import Markdown', 0);
        await insertPythonCell('dh = display(Markdown("foo"), display_id=True)', 1);
        let cells = vscodeNotebook.activeNotebookEditor?.document.cells!;

        await executeActiveDocument();
        await waitForCondition(
            async () => assertHasExecutionCompletedSuccessfully(cells[1]),
            15_000,
            'Cell did not get executed'
        );

        assert.equal(cells[0].outputs.length, 0, 'Incorrect number of output');
        assert.equal(cells[1].outputs.length, 1, 'Incorrect number of output');
        assert.equal(cells[1].outputs[0].outputKind, vscodeNotebookEnums.CellOutputKind.Rich, 'Incorrect output type');
        assert.equal((cells[1].outputs[0] as CellDisplayOutput).data['text/markdown'], 'foo', 'Incorrect output value');
        const displayId = (cells[1].outputs[0] as CellDisplayOutput).metadata?.custom?.transient?.display_id;
        assert.ok(displayId, 'Display id not present in metadata');

        await insertPythonCell(
            dedent`
                    dh.update(Markdown("bar"))
                    print('hello')`,
            2
        );
        await executeActiveDocument();
        cells = vscodeNotebook.activeNotebookEditor?.document.cells!;
        await waitForCondition(
            async () => assertHasExecutionCompletedSuccessfully(cells[2]),
            15_000,
            'Cell did not get executed'
        );

        assert.equal(cells[0].outputs.length, 0, 'Incorrect number of output');
        assert.equal(cells[1].outputs.length, 1, 'Incorrect number of output');
        assert.equal(cells[2].outputs.length, 1, 'Incorrect number of output');
        assert.equal(cells[1].outputs[0].outputKind, vscodeNotebookEnums.CellOutputKind.Rich, 'Incorrect output type');
        assert.equal((cells[1].outputs[0] as CellDisplayOutput).data['text/markdown'], 'bar', 'Incorrect output value');
        assertHasTextOutputInVSCode(cells[2], 'hello', 0, false);
    });
});
