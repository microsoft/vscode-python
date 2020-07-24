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
    assertHasOutputInICell,
    assertHasOutputInVSCell,
    canRunTests,
    closeNotebooksAndCleanUpAfterTests,
    createTemporaryNotebook,
    deleteAllCellsAndWait,
    insertPythonCellAndWait,
    waitForCellHasEmptyOutput,
    waitForExecutionCompletedSuccessfully,
    waitForExecutionOrderInCell,
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
            const testIPynb = Uri.file(await createTemporaryNotebook(templateIPynb, disposables2));
            await editorProvider.open(testIPynb);
        });
        test('Clearing output when not executing', async () => {
            const vscCells = vscodeNotebook.activeNotebookEditor?.document.cells!;
            const model = editorProvider.activeEditor?.model!;
            const cellModels = model.cells!;

            // Verify we have execution counts and output.
            assertHasExecutionCompletedSuccessfully(vscCells[0]);
            assertHasExecutionCompletedWithErrors(vscCells[1]);
            assertHasExecutionCompletedSuccessfully(vscCells[2]);
            assertHasOutputInVSCell(vscCells[0]);
            assertHasOutputInVSCell(vscCells[1]);
            assertHasOutputInVSCell(vscCells[2]);
            assertHasOutputInICell(cellModels[0], model);
            assertHasOutputInICell(cellModels[1], model);
            assertHasOutputInICell(cellModels[2], model);

            // Clear the cells
            await commands.executeCommand('notebook.clearAllCellsOutputs');

            for (let cellIndex = 0; cellIndex < 3; cellIndex += 1) {
                await waitForExecutionOrderInVSCCell(vscCells[cellIndex], undefined);
                await waitForExecutionOrderInCell(cellModels[cellIndex], undefined, model);

                await waitForVSCCellHasEmptyOutput(vscCells[cellIndex]);
                await waitForCellHasEmptyOutput(cellModels[cellIndex], model);
            }
        });
    });
    suite('Use same notebook for tests', () => {
        suiteSetup(async () => {
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

        test('Clear cell status, output and execution count before executing a cell', async () => {
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
        test('Clear cell output while executing will only clear output when executing a cell', async () => {
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
