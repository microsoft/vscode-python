// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable: no-var-requires no-require-imports no-invalid-this no-any

import { nbformat } from '@jupyterlab/coreutils';
import { assert, expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as sinon from 'sinon';
import * as tmp from 'tmp';
import { instance, mock } from 'ts-mockito';
import { commands, Memento, TextDocument, Uri } from 'vscode';
import { NotebookCell, NotebookDocument } from '../../../../types/vscode-proposed';
import { CellDisplayOutput } from '../../../../typings/vscode-proposed';
import { IApplicationEnvironment, IVSCodeNotebook } from '../../../client/common/application/types';
import { MARKDOWN_LANGUAGE, PYTHON_LANGUAGE } from '../../../client/common/constants';
import { IConfigurationService, ICryptoUtils, IDisposable } from '../../../client/common/types';
import { noop, swallowExceptions } from '../../../client/common/utils/misc';
import { Identifiers } from '../../../client/datascience/constants';
import { JupyterNotebookView } from '../../../client/datascience/notebook/constants';
import { createVSCNotebookCellDataFromCell } from '../../../client/datascience/notebook/helpers/helpers';
import { INotebookContentProvider } from '../../../client/datascience/notebook/types';
import { VSCodeNotebookModel } from '../../../client/datascience/notebookStorage/vscNotebookModel';
import {
    CellState,
    ICell,
    INotebookEditorProvider,
    INotebookModel,
    INotebookProvider
} from '../../../client/datascience/types';
import { createEventHandler, waitForCondition } from '../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';
import { closeActiveWindows, initialize } from '../../initialize';
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

async function getServices() {
    const api = await initialize();
    return {
        contentProvider: api.serviceContainer.get<INotebookContentProvider>(INotebookContentProvider),
        vscodeNotebook: api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook),
        editorProvider: api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider)
    };
}

export async function insertMarkdownCell(source: string, index: number = 0) {
    const { vscodeNotebook } = await getServices();
    const vscEditor = vscodeNotebook.activeNotebookEditor;
    await new Promise((resolve) =>
        vscEditor?.edit((builder) => {
            builder.insert(index, source, MARKDOWN_LANGUAGE, vscodeNotebookEnums.CellKind.Markdown, [], undefined);
            resolve();
        })
    );

    await waitForCondition(
        async () => vscEditor?.document.cells[index].document.getText().trim() === source.trim(),
        5_000,
        'Cell not inserted'
    );
}
export async function insertPythonCell(source: string, index: number = 0) {
    const { vscodeNotebook } = await getServices();
    const vscEditor = vscodeNotebook.activeNotebookEditor;
    await new Promise((resolve) =>
        vscEditor?.edit((builder) => {
            builder.insert(index, source, PYTHON_LANGUAGE, vscodeNotebookEnums.CellKind.Code, [], undefined);
            resolve();
        })
    );

    await waitForCondition(
        async () => vscEditor?.document.cells[index].document.getText().trim() === source.trim(),
        5_000,
        'Cell not inserted'
    );
}
export async function insertPythonCellAndWait(source: string, index: number = 0) {
    await insertPythonCell(source, index);
}
export async function insertMarkdownCellAndWait(source: string, index: number = 0) {
    await insertMarkdownCell(source, index);
}
export async function deleteCell(index: number = 0) {
    const { vscodeNotebook } = await getServices();
    const activeEditor = vscodeNotebook.activeNotebookEditor;
    await new Promise((resolve) =>
        activeEditor?.edit((builder) => {
            builder.delete(index);
            resolve();
        })
    );
}
export async function deleteAllCellsAndWait(index: number = 0) {
    const { vscodeNotebook } = await getServices();
    const activeEditor = vscodeNotebook.activeNotebookEditor;
    if (!activeEditor) {
        return;
    }
    const vscCells = activeEditor.document.cells!;
    let previousCellOut = vscCells.length;
    while (previousCellOut) {
        await new Promise((resolve) =>
            activeEditor?.edit((builder) => {
                builder.delete(index);
                resolve();
            })
        );
        // Wait for cell to get deleted.
        await waitForCondition(async () => vscCells.length === previousCellOut - 1, 1_000, 'Cell not deleted');
        previousCellOut = vscCells.length;
    }
}

export async function createTemporaryFile(options: {
    templateFile: string;
    dir: string;
}): Promise<{ file: string } & IDisposable> {
    const extension = path.extname(options.templateFile);
    const tempFile = tmp.tmpNameSync({ postfix: extension, dir: options.dir });
    await fs.copyFile(options.templateFile, tempFile);
    return { file: tempFile, dispose: () => swallowExceptions(() => fs.unlinkSync(tempFile)) };
}

export async function createTemporaryNotebook(templateFile: string, disposables: IDisposable[]): Promise<string> {
    const extension = path.extname(templateFile);
    fs.ensureDirSync(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'tmp'));
    const tempFile = tmp.tmpNameSync({ postfix: extension, dir: path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'tmp') });
    await fs.copyFile(templateFile, tempFile);
    disposables.push({ dispose: () => swallowExceptions(() => fs.unlinkSync(tempFile)) });
    return tempFile;
}

export function disposeAllDisposables(disposables: IDisposable[]) {
    while (disposables.length) {
        disposables.pop()?.dispose(); // NOSONAR;
    }
}

export async function canRunTests() {
    const api = await initialize();
    const appEnv = api.serviceContainer.get<IApplicationEnvironment>(IApplicationEnvironment);
    return appEnv.extensionChannel !== 'stable';
}

/**
 * We will be editing notebooks, to close notebooks them we need to ensure changes are saved.
 * Else when we close notebooks as part of teardown in tests, things will not work as nbs are dirty.
 * Solution - swallow saves this way when VSC fires save, we resolve and VSC thinks nb got saved and marked as not dirty.
 */
export async function swallowSavingOfNotebooks() {
    const api = await initialize();
    // We will be editing notebooks, to close notebooks them we need to ensure changes are saved.
    const contentProvider = api.serviceContainer.get<INotebookContentProvider>(INotebookContentProvider);
    sinon.stub(contentProvider, 'saveNotebook').callsFake(noop as any);
    sinon.stub(contentProvider, 'saveNotebookAs').callsFake(noop as any);
}

export async function shutdownAllNotebooks() {
    const api = await initialize();
    const notebookProvider = api.serviceContainer.get<INotebookProvider>(INotebookProvider);
    await Promise.all(notebookProvider.activeNotebooks.map(async (item) => (await item).dispose()));
}

let oldValueFor_alwaysTrustNotebooks: undefined | boolean;
export async function closeNotebooksAndCleanUpAfterTests(disposables: IDisposable[] = []) {
    await closeActiveWindows();
    disposeAllDisposables(disposables);
    await shutdownAllNotebooks();
    if (typeof oldValueFor_alwaysTrustNotebooks === 'boolean') {
        const api = await initialize();
        const dsSettings = api.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings()
            .datascience;
        dsSettings.alwaysTrustNotebooks = oldValueFor_alwaysTrustNotebooks;
        oldValueFor_alwaysTrustNotebooks = undefined;
    }

    sinon.restore();
}
export async function closeNotebooks(disposables: IDisposable[] = []) {
    await closeActiveWindows();
    disposeAllDisposables(disposables);
}

export async function trustAllNotebooks() {
    const api = await initialize();
    const dsSettings = api.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings().datascience;
    if (oldValueFor_alwaysTrustNotebooks !== undefined) {
        oldValueFor_alwaysTrustNotebooks = dsSettings.alwaysTrustNotebooks;
    }
    dsSettings.alwaysTrustNotebooks = true;
}
export async function startJupyter() {
    const { editorProvider, vscodeNotebook } = await getServices();
    await closeActiveWindows();

    const disposables: IDisposable[] = [];
    try {
        const templateIPynb = path.join(
            EXTENSION_ROOT_DIR_FOR_TESTS,
            'src',
            'test',
            'datascience',
            'notebook',
            'empty.ipynb'
        );
        const tempIPynb = await createTemporaryNotebook(templateIPynb, disposables);
        await editorProvider.open(Uri.file(tempIPynb));
        await insertPythonCell('print("Hello World")', 0);
        const cell = vscodeNotebook.activeNotebookEditor!.document.cells[0]!;
        await executeActiveDocument();
        // Wait for Jupyter to start.
        await waitForCondition(async () => cell.outputs.length > 0, 30_000, 'Cell not executed');

        await closeActiveWindows();
    } finally {
        disposables.forEach((d) => d.dispose());
    }
}

export function assertHasExecutionCompletedSuccessfully(cell: NotebookCell) {
    return (
        (cell.metadata.executionOrder ?? 0) > 0 &&
        cell.metadata.runState === vscodeNotebookEnums.NotebookCellRunState.Success
    );
}
export async function waitForExecutionCompletedSuccessfully(cell: NotebookCell) {
    await waitForCondition(
        async () => assertHasExecutionCompletedSuccessfully(cell),
        1_000,
        `Cell ${cell.notebook.cells.indexOf(cell) + 1} did not complete successfully`
    );
}
export function assertExecutionOrderInVSCCell(cell: NotebookCell, executionOrder?: number) {
    assert.equal(cell.metadata.executionOrder, executionOrder);
    return true;
}
export async function waitForExecutionOrderInVSCCell(cell: NotebookCell, executionOrder: number | undefined) {
    await waitForCondition(
        async () => assertExecutionOrderInVSCCell(cell, executionOrder),
        1_000,
        `Execution count not '${executionOrder}' for Cell ${cell.notebook.cells.indexOf(cell) + 1}`
    );
}
export async function waitForExecutionOrderInCell(
    cell: ICell,
    executionOrder: number | undefined,
    model: INotebookModel
) {
    await waitForCondition(
        async () => {
            if (executionOrder === undefined || executionOrder === null) {
                return cell.data.execution_count === null;
            }
            return cell.data.execution_count === executionOrder;
        },
        1_000,
        `Execution count not '${executionOrder}' for ICell ${model.cells.indexOf(cell) + 1}`
    );
}
export function assertHasExecutionCompletedWithErrors(cell: NotebookCell) {
    return (
        (cell.metadata.executionOrder ?? 0) > 0 &&
        cell.metadata.runState === vscodeNotebookEnums.NotebookCellRunState.Error
    );
}
export function assertHasOutputInVSCell(cell: NotebookCell) {
    assert.ok(cell.outputs.length, `No output in Cell ${cell.notebook.cells.indexOf(cell) + 1}`);
}
export function assertHasOutputInICell(cell: ICell, model: INotebookModel) {
    assert.ok((cell.data.outputs as nbformat.IOutput[]).length, `No output in ICell ${model.cells.indexOf(cell) + 1}`);
}
export function assertHasTextOutputInVSCode(cell: NotebookCell, text: string, index: number, isExactMatch = true) {
    const cellOutputs = cell.outputs;
    assert.ok(cellOutputs, 'No output');
    assert.equal(cellOutputs[index].outputKind, vscodeNotebookEnums.CellOutputKind.Rich, 'Incorrect output kind');
    const outputText = (cellOutputs[index] as CellDisplayOutput).data['text/plain'].trim();
    if (isExactMatch) {
        assert.equal(outputText, text, 'Incorrect output');
    } else {
        expect(outputText).to.include(text, 'Output does not contain provided text');
    }
    return true;
}
export async function waitForTextOutputInVSCode(
    cell: NotebookCell,
    text: string,
    index: number,
    isExactMatch = true,
    timeout = 1_000
) {
    await waitForCondition(
        async () => assertHasTextOutputInVSCode(cell, text, index, isExactMatch),
        timeout,
        `Output does not contain provided text '${text}' for Cell ${cell.notebook.cells.indexOf(cell) + 1}`
    );
}
export function assertNotHasTextOutputInVSCode(cell: NotebookCell, text: string, index: number, isExactMatch = true) {
    const cellOutputs = cell.outputs;
    assert.ok(cellOutputs, 'No output');
    assert.equal(cellOutputs[index].outputKind, vscodeNotebookEnums.CellOutputKind.Rich, 'Incorrect output kind');
    const outputText = (cellOutputs[index] as CellDisplayOutput).data['text/plain'].trim();
    if (isExactMatch) {
        assert.notEqual(outputText, text, 'Incorrect output');
    } else {
        expect(outputText).to.not.include(text, 'Output does not contain provided text');
    }
    return true;
}
export function assertHasTextOutputInICell(cell: ICell, text: string, index: number) {
    const cellOutputs = cell.data.outputs as nbformat.IOutput[];
    assert.ok(cellOutputs, 'No output');
    assert.equal((cellOutputs[index].text as string).trim(), text, 'Incorrect output');
}
export function assertVSCCellIsRunning(cell: NotebookCell) {
    assert.equal(cell.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Running);
    return true;
}
export async function waitForVSCCellHasEmptyOutput(cell: NotebookCell) {
    await waitForCondition(
        async () => cell.outputs.length === 0,
        1_000,
        `Cell ${cell.notebook.cells.indexOf(cell) + 1} output did not get cleared`
    );
}
export async function waitForCellHasEmptyOutput(cell: ICell, model: INotebookModel) {
    await waitForCondition(
        async () => !Array.isArray(cell.data.outputs) || cell.data.outputs.length === 0,
        1_000,
        `ICell ${model.cells.indexOf(cell) + 1} output did not get cleared`
    );
}
export async function waitForVSCCellIsRunning(cell: NotebookCell) {
    await waitForCondition(
        async () => assertVSCCellIsRunning(cell),
        1_000,
        `Cell ${cell.notebook.cells.indexOf(cell) + 1} did not start`
    );
}
export function assertVSCCellIsNotRunning(cell: NotebookCell) {
    assert.notEqual(cell.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Running);
    return true;
}
export function assertVSCCellIsIdle(cell: NotebookCell) {
    assert.equal(cell.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Idle);
    return true;
}
export function assertVSCCellStateIsUndefined(cell: NotebookCell) {
    assert.isUndefined(cell.metadata.runState);
    return true;
}
export function assertVSCCellHasErrors(cell: NotebookCell) {
    assert.equal(cell.metadata.runState, vscodeNotebookEnums.NotebookCellRunState.Error);
    return true;
}
export function assertVSCCellHasErrorOutput(cell: NotebookCell) {
    assert.ok(
        cell.outputs.filter((output) => output.outputKind === vscodeNotebookEnums.CellOutputKind.Error).length,
        'No error output in cell'
    );
    return true;
}

export async function saveActiveNotebook(disposables: IDisposable[]) {
    const api = await initialize();
    const editorProvider = api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider);
    const savedEvent = createEventHandler(editorProvider.activeEditor!.model!, 'changed', disposables);
    await commands.executeCommand('workbench.action.files.saveAll');

    await waitForCondition(async () => savedEvent.all.some((e) => e.kind === 'save'), 5_000, 'Not saved');
}

export function createNotebookModel(
    trusted: boolean,
    uri: Uri,
    globalMemento: Memento,
    crypto: ICryptoUtils,
    nb?: Partial<nbformat.INotebookContent>
) {
    const nbJson: nbformat.INotebookContent = {
        cells: [],
        metadata: {
            orig_nbformat: 4
        },
        nbformat: 4,
        nbformat_minor: 4,
        ...(nb || {})
    };

    const cells = nbJson.cells.map((c, index) => {
        return {
            id: `NotebookImport#${index}`,
            file: Identifiers.EmptyFileName,
            line: 0,
            state: CellState.finished,
            data: c
        };
    });
    return new VSCodeNotebookModel(trusted, uri, JSON.parse(JSON.stringify(cells)), globalMemento, crypto, nbJson);
}
export async function executeCell(cell: NotebookCell) {
    const api = await initialize();
    const vscodeNotebook = api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook);
    await waitForCondition(
        async () => !!vscodeNotebook.activeNotebookEditor?.kernel,
        60_000, // Validating kernel can take a while.
        'Timeout waiting for active kernel'
    );
    if (!vscodeNotebook.activeNotebookEditor || !vscodeNotebook.activeNotebookEditor.kernel) {
        throw new Error('No notebook or kernel');
    }
    // Execute cells (it should throw an error).
    vscodeNotebook.activeNotebookEditor.kernel.executeCell(cell.notebook, cell);
}
export async function executeActiveDocument() {
    const api = await initialize();
    const vscodeNotebook = api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook);
    await waitForCondition(
        async () => !!vscodeNotebook.activeNotebookEditor?.kernel,
        60_000, // Validating kernel can take a while.
        'Timeout waiting for active kernel'
    );
    if (!vscodeNotebook.activeNotebookEditor || !vscodeNotebook.activeNotebookEditor.kernel) {
        throw new Error('No notebook or kernel');
    }
    // Execute cells (it should throw an error).
    vscodeNotebook.activeNotebookEditor.kernel.executeAllCells(vscodeNotebook.activeNotebookEditor.document);
}
export function createNotebookDocument(
    model: VSCodeNotebookModel,
    viewType: string = JupyterNotebookView
): NotebookDocument {
    const doc: NotebookDocument = {
        cells: [],
        fileName: model.file.fsPath,
        isDirty: false,
        languages: [],
        uri: model.file,
        viewType,
        metadata: {
            cellEditable: model.isTrusted,
            cellHasExecutionOrder: true,
            cellRunnable: model.isTrusted,
            editable: model.isTrusted,
            runnable: model.isTrusted
        }
    };
    model.cells.forEach((cell, index) => {
        const vscCell = createVSCNotebookCellDataFromCell(model, cell)!;
        const vscDocumentCell: NotebookCell = {
            ...vscCell,
            uri: model.file.with({ fragment: `cell${index}` }),
            notebook: doc,
            document: instance(mock<TextDocument>())
        };
        doc.cells.push(vscDocumentCell);
    });
    model.associateNotebookDocument(doc);
    return doc;
}
