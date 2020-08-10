// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-require-imports no-var-requires
import { join } from 'path';
import { Subject } from 'rxjs/Subject';
import * as sinon from 'sinon';
import { anything, instance, mock, reset, when } from 'ts-mockito';
import { commands, Uri } from 'vscode';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { IDisposable } from '../../../client/common/types';
import {
    CellState,
    ICell,
    INotebook,
    INotebookEditorProvider,
    INotebookProvider
} from '../../../client/datascience/types';
import { IExtensionTestApi } from '../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS, initialize } from '../../initialize';
import {
    assertHasExecutionCompletedSuccessfully,
    assertHasExecutionCompletedWithErrors,
    assertHasOutputInVSCell,
    canRunTests,
    closeNotebooksAndCleanUpAfterTests,
    createTemporaryNotebook,
    deleteAllCellsAndWait,
    insertPythonCellAndWait,
    trustAllNotebooks,
    waitForExecutionCompletedSuccessfully,
    waitForExecutionOrderInVSCCell,
    waitForTextOutputInVSCode,
    waitForVSCCellHasEmptyOutput,
    waitForVSCCellIsRunning
} from './helper';

// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

// tslint:disable: no-any no-invalid-this
suite('DataScience - VSCode Notebook - (fake execution) (Clearing Output)', function () {
    this.timeout(10_000);

    let api: IExtensionTestApi;
    let editorProvider: INotebookEditorProvider;
    let vscodeNotebook: IVSCodeNotebook;
    let notebookProvider: INotebookProvider;
    let nb: INotebook;
    let cellObservableResult: Subject<ICell[]>;
    let cell2ObservableResult: Subject<ICell[]>;

    suiteSetup(async function () {
        api = await initialize();
        if (!(await canRunTests())) {
            return this.skip();
        }
        await trustAllNotebooks();
        vscodeNotebook = api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook);
        notebookProvider = api.serviceContainer.get<INotebookProvider>(INotebookProvider);
        editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
    });
    suiteTeardown(() => closeNotebooksAndCleanUpAfterTests([]));
    suite('Different notebooks in each test', () => {
        const disposables2: IDisposable[] = [];
        const templateIPynb = join(
            EXTENSION_ROOT_DIR_FOR_TESTS,
            'src',
            'test',
            'datascience',
            'notebook',
            'with3CellsAndOutput.ipynb'
        );
        suiteTeardown(() => closeNotebooksAndCleanUpAfterTests(disposables2));
        setup(async () => {
            await trustAllNotebooks();
            const testIPynb = Uri.file(await createTemporaryNotebook(templateIPynb, disposables2));
            await editorProvider.open(testIPynb);
        });
        test('Clearing output when not executing', async function () {
            // tslint:disable-next-line: no-unused-expression
            return this.skip();
            const cells = vscodeNotebook.activeNotebookEditor?.document.cells!;

            // Verify we have execution counts and output.
            assertHasExecutionCompletedSuccessfully(cells[0]);
            assertHasExecutionCompletedWithErrors(cells[1]);
            assertHasExecutionCompletedSuccessfully(cells[2]);
            assertHasOutputInVSCell(cells[0]);
            assertHasOutputInVSCell(cells[1]);
            assertHasOutputInVSCell(cells[2]);

            // Clear the cells
            await commands.executeCommand('notebook.clearAllCellsOutputs');

            for (let cellIndex = 0; cellIndex < 3; cellIndex += 1) {
                // https://github.com/microsoft/vscode-python/issues/13159
                // await waitForExecutionOrderInVSCCell(cells[cellIndex], undefined);

                await waitForVSCCellHasEmptyOutput(cells[cellIndex]);
            }
        });
    });
    suite('Use same notebook for tests', () => {
        suiteSetup(async () => {
            await trustAllNotebooks();
            // Open a notebook and use this for all tests in this test suite.
            await editorProvider.createNew();
        });
        setup(async () => {
            sinon.restore();
            const getOrCreateNotebook = sinon.stub(notebookProvider, 'getOrCreateNotebook');
            nb = mock<INotebook>();
            (instance(nb) as any).then = undefined;
            getOrCreateNotebook.resolves(instance(nb));

            cellObservableResult = new Subject<ICell[]>();
            cell2ObservableResult = new Subject<ICell[]>();
            reset(nb);
            when(nb.executeObservable(anything(), anything(), anything(), anything(), anything())).thenReturn(
                cellObservableResult.asObservable()
            );
            await deleteAllCellsAndWait();
        });
        teardown(() => {
            cellObservableResult.unsubscribe();
            cell2ObservableResult.unsubscribe();
        });

        test('Clear cell status, output and execution count before executing a cell', async function () {
            // tslint:disable-next-line: no-unused-expression
            return this.skip();

            await insertPythonCellAndWait('# Some bogus cell', 0);
            const vscCell = vscodeNotebook.activeNotebookEditor?.document.cells![0]!;
            // Setup original state in cell.
            vscCell.outputs = [{ outputKind: vscodeNotebookEnums.CellOutputKind.Text, text: 'Output1' }];
            vscCell.metadata.statusMessage = 'Error Message';
            vscCell.metadata.executionOrder = 999;

            // Once we execute the cell, the execution count & output should be cleared.
            await commands.executeCommand('notebook.cell.execute');
            await waitForExecutionOrderInVSCCell(vscCell, undefined);
            await waitForVSCCellHasEmptyOutput(vscCell);
            await waitForVSCCellIsRunning(vscCell);

            // Now send some output.
            const executionCount = 22;
            cellObservableResult.next([
                {
                    data: {
                        cell_type: 'code',
                        execution_count: 22,
                        metadata: {},
                        outputs: [{ output_type: 'stream', name: 'stdout', text: 'Hello' }],
                        source: ''
                    },
                    file: '',
                    id: vscCell.uri.toString(),
                    line: 1,
                    state: CellState.executing
                }
            ]);

            // Confirm output was received by VS Code.
            await waitForExecutionOrderInVSCCell(vscCell, executionCount);
            await waitForTextOutputInVSCode(vscCell, 'Hello', 0);

            // Complete the execution.
            cellObservableResult.complete();

            // Confirm output is the same and status is a success.
            await waitForExecutionCompletedSuccessfully(vscCell);
            await waitForExecutionOrderInVSCCell(vscCell, executionCount);
            await waitForTextOutputInVSCode(vscCell, 'Hello', 0);
        });
        test('Clear cell output while executing will only clear output when executing a cell', async function () {
            // tslint:disable-next-line: no-unused-expression
            return this.skip();
            await insertPythonCellAndWait('# Some bogus cell', 0);
            const vscCell = vscodeNotebook.activeNotebookEditor?.document.cells![0]!;
            // Setup original state in cell.
            vscCell.outputs = [{ outputKind: vscodeNotebookEnums.CellOutputKind.Text, text: 'Output1' }];
            vscCell.metadata.statusMessage = 'Error Message';
            vscCell.metadata.executionOrder = 999;

            // Once we execute the cell, the execution count & output should be cleared.
            await commands.executeCommand('notebook.cell.execute');

            await waitForExecutionOrderInVSCCell(vscCell, undefined);
            await waitForVSCCellHasEmptyOutput(vscCell);
            await waitForVSCCellIsRunning(vscCell);

            // Now send some output.
            const executionCount = 22;
            cellObservableResult.next([
                {
                    data: {
                        cell_type: 'code',
                        execution_count: 22,
                        metadata: {},
                        outputs: [{ output_type: 'stream', name: 'stdout', text: 'Hello' }],
                        source: ''
                    },
                    file: '',
                    id: vscCell.uri.toString(),
                    line: 1,
                    state: CellState.executing
                }
            ]);

            // Confirm output was received by VS Code.
            await waitForExecutionOrderInVSCCell(vscCell, executionCount);
            await waitForTextOutputInVSCode(vscCell, 'Hello', 0);

            // Clear output.
            await commands.executeCommand('notebook.clearAllCellsOutputs');

            // Confirm output was cleared & execution order has not been cleared & cell is still running.
            await waitForVSCCellHasEmptyOutput(vscCell);
            await waitForExecutionOrderInVSCCell(vscCell, executionCount);
            await waitForVSCCellIsRunning(vscCell);

            // Complete the execution.
            cellObservableResult.complete();

            // Confirm output is the same and status is a success.
            await waitForExecutionCompletedSuccessfully(vscCell);
            await waitForExecutionOrderInVSCCell(vscCell, executionCount);
            await waitForVSCCellHasEmptyOutput(vscCell);
        });
    });
});
