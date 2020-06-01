// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-require-imports no-var-requires
import { assert } from 'chai';
import * as sinon from 'sinon';
import { commands } from 'vscode';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { IDisposable } from '../../../client/common/types';
import { INotebookEditorProvider } from '../../../client/datascience/types';
import { IExtensionTestApi, waitForCondition } from '../../common';
import { initialize } from '../../initialize';
import {
    assertHasExecutionCompletedSuccessfully,
    assertHasTextOutputInICell,
    assertHasTextOutputInVSCode,
    canRunTests,
    closeNotebooksAndCleanUpAfterTests,
    deleteAllCellsAndWait,
    insertPythonCellAndWait,
    startJupyter,
    swallowSavingOfNotebooks
} from './helper';

// tslint:disable: no-any no-invalid-this
suite('DataScience - VSCode Notebook - (Execution)', function () {
    this.timeout(15_000);

    let api: IExtensionTestApi;
    let editorProvider: INotebookEditorProvider;
    const disposables: IDisposable[] = [];
    let vscodeNotebook: IVSCodeNotebook;
    suiteSetup(async function () {
        this.timeout(15_000);
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
        // tslint:disable-next-line: no-suspicious-comment
        // TODO: Known bug in VSC, cells do not get added in order.
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
        assertHasTextOutputInVSCode(vscCell[1], 'Hello World', 0);
        assertHasTextOutputInICell(cellModels[1], 'Hello World', 0);
        assertHasTextOutputInVSCode(vscCell[0], 'Foo Bar', 0);
        assertHasTextOutputInICell(cellModels[0], 'Foo Bar', 0);

        // Verify execution count.
        assert.ok(vscCell[0].metadata.executionOrder, 'Execution count should be > 0');
        assert.equal(vscCell[1].metadata.executionOrder! - 1, vscCell[0].metadata.executionOrder!);
    });
});
