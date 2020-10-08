// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable: no-var-requires no-require-imports no-invalid-this no-any

import { nbformat } from '@jupyterlab/coreutils';
import { assert, expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as sinon from 'sinon';
import * as tmp from 'tmp';
import { instance, mock, when } from 'ts-mockito';
import { commands, Memento, TextDocument, Uri } from 'vscode';
import {
    CellDisplayOutput,
    NotebookCell,
    NotebookContentProvider as VSCNotebookContentProvider,
    NotebookDocument
} from '../../../../typings/vscode-proposed';
import { IApplicationEnvironment, IVSCodeNotebook } from '../../../client/common/application/types';
import { MARKDOWN_LANGUAGE, PYTHON_LANGUAGE } from '../../../client/common/constants';
import { IConfigurationService, ICryptoUtils, IDisposable } from '../../../client/common/types';
import { noop, swallowExceptions } from '../../../client/common/utils/misc';
import { Identifiers } from '../../../client/datascience/constants';
import { JupyterNotebookView } from '../../../client/datascience/notebook/constants';
import { NotebookCellLanguageService } from '../../../client/datascience/notebook/defaultCellLanguageService';
import { createVSCNotebookCellDataFromCell } from '../../../client/datascience/notebook/helpers/helpers';
import { VSCodeNotebookKernelMetadata } from '../../../client/datascience/notebook/kernelProvider';
import { NotebookEditor } from '../../../client/datascience/notebook/notebookEditor';
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
        contentProvider: api.serviceContainer.get<VSCNotebookContentProvider>(INotebookContentProvider),
        vscodeNotebook: api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook),
        editorProvider: api.serviceContainer.get<INotebookEditorProvider>(INotebookEditorProvider)
    };
}

export async function insertMarkdownCell(source: string) {
    const { vscodeNotebook } = await getServices();
    const activeEditor = vscodeNotebook.activeNotebookEditor;
    if (!activeEditor) {
        assert.fail('No active editor');
        return;
    }
    await activeEditor.edit((edit) =>
        edit.replaceCells(activeEditor.document.cells.length, 0, [
            {
                cellKind: vscodeNotebookEnums.CellKind.Markdown,
                language: MARKDOWN_LANGUAGE,
                source,
                metadata: {
                    hasExecutionOrder: false
                },
                outputs: []
            }
        ])
    );
}
export async function insertCodeCell(source: string, options?: { language?: string; index?: number }) {
    const { vscodeNotebook } = await getServices();
    const activeEditor = vscodeNotebook.activeNotebookEditor;
    if (!activeEditor) {
        assert.fail('No active editor');
        return;
    }
    const startNumber = options?.index ?? activeEditor.document.cells.length;
    await activeEditor.edit((edit) =>
        edit.replaceCells(startNumber, 0, [
            {
                cellKind: vscodeNotebookEnums.CellKind.Code,
                language: options?.language || PYTHON_LANGUAGE,
                source,
                metadata: {
                    hasExecutionOrder: false
                },
                outputs: []
            }
        ])
    );
}
export async function deleteCell(index: number = 0) {
    const { vscodeNotebook } = await getServices();
    const activeEditor = vscodeNotebook.activeNotebookEditor;
    if (!activeEditor || activeEditor.document.cells.length === 0) {
        return;
    }
    if (!activeEditor) {
        assert.fail('No active editor');
        return;
    }
    await activeEditor.edit((edit) => edit.replaceCells(index, 1, []));
}
export async function deleteAllCellsAndWait() {
    const { vscodeNotebook } = await getServices();
    const activeEditor = vscodeNotebook.activeNotebookEditor;
    if (!activeEditor || activeEditor.document.cells.length === 0) {
        return;
    }
    await activeEditor.edit((edit) => edit.replaceCells(0, activeEditor.document.cells.length, []));
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
    const contentProvider = api.serviceContainer.get<VSCNotebookContentProvider>(INotebookContentProvider);
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

export async function waitForKernelToGetAutoSelected(expectedLanguage?: string) {
    const { vscodeNotebook } = await getServices();

    // Wait for the active kernel to be a julia kernel.
    await waitForCondition(
        async () => !!vscodeNotebook.activeNotebookEditor?.kernel,
        10_000,
        'Kernel not auto selected'
    );

    const isRightKernel = () => {
        if (!vscodeNotebook.activeNotebookEditor) {
            return false;
        }
        if (!vscodeNotebook.activeNotebookEditor.kernel) {
            return false;
        }
        if (!expectedLanguage) {
            return true;
        }
        if (vscodeNotebook.activeNotebookEditor.kernel instanceof VSCodeNotebookKernelMetadata) {
            if (vscodeNotebook.activeNotebookEditor.kernel.selection.kind === 'startUsingKernelSpec') {
                return (
                    vscodeNotebook.activeNotebookEditor.kernel.selection.kernelSpec.language.toLowerCase() ===
                    expectedLanguage.toLowerCase()
                );
            }
            if (vscodeNotebook.activeNotebookEditor.kernel.selection.kind === 'startUsingPythonInterpreter') {
                return expectedLanguage.toLowerCase() === PYTHON_LANGUAGE.toLowerCase();
            }
            // We don't support testing other kernels, not required hence not added.
            // tslint:disable-next-line: no-console
            console.error('Testing other kernel connections not supported');
        }
        return false;
    };

    // Wait for the active kernel to be a julia kernel.
    const errorMessage = expectedLanguage ? `${expectedLanguage} kernel not auto selected` : 'Kernel not auto selected';
    await waitForCondition(async () => isRightKernel(), 15_000, errorMessage);
}
export async function trustAllNotebooks() {
    const api = await initialize();
    const dsSettings = api.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings().datascience;
    if (oldValueFor_alwaysTrustNotebooks !== undefined) {
        oldValueFor_alwaysTrustNotebooks = dsSettings.alwaysTrustNotebooks;
    }
    dsSettings.alwaysTrustNotebooks = true;
}
export async function startJupyter(closeInitialEditor: boolean) {
    const { editorProvider, vscodeNotebook } = await getServices();
    await closeActiveWindows();

    const disposables: IDisposable[] = [];
    try {
        await editorProvider.createNew();
        await insertCodeCell('print("Hello World")', { index: 0 });
        const cell = vscodeNotebook.activeNotebookEditor!.document.cells[0]!;
        await executeActiveDocument();
        // Wait for Jupyter to start.
        await waitForCondition(async () => cell.outputs.length > 0, 60_000, 'Cell not executed');

        if (closeInitialEditor) {
            await closeActiveWindows();
        } else {
            await deleteCell(0);
        }
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
        `Cell ${cell.index + 1} did not complete successfully`
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
        `Execution count not '${executionOrder}' for Cell ${cell.index + 1}`
    );
}
export async function waitForExecutionOrderInCell(cell: NotebookCell, executionOrder: number | undefined) {
    await waitForCondition(
        async () => {
            if (executionOrder === undefined || executionOrder === null) {
                return cell.metadata.executionOrder === undefined;
            }
            return cell.metadata.executionOrder === executionOrder;
        },
        15_000,
        `Execution count not '${executionOrder}' for Cell ${cell.index}`
    );
}
export function assertHasExecutionCompletedWithErrors(cell: NotebookCell) {
    return (
        (cell.metadata.executionOrder ?? 0) > 0 &&
        cell.metadata.runState === vscodeNotebookEnums.NotebookCellRunState.Error
    );
}
export function assertHasOutputInVSCell(cell: NotebookCell) {
    assert.ok(cell.outputs.length, `No output in Cell ${cell.index + 1}`);
}
export function assertHasOutputInICell(cell: ICell, model: INotebookModel) {
    assert.ok((cell.data.outputs as nbformat.IOutput[]).length, `No output in ICell ${model.cells.indexOf(cell) + 1}`);
}
export function assertHasTextOutputInVSCode(cell: NotebookCell, text: string, index: number = 0, isExactMatch = true) {
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
        `Output does not contain provided text '${text}' for Cell ${cell.index + 1}`
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
        `Cell ${cell.index + 1} output did not get cleared`
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
    await waitForCondition(async () => assertVSCCellIsRunning(cell), 1_000, `Cell ${cell.index + 1} did not start`);
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
    if (editorProvider.activeEditor instanceof NotebookEditor) {
        await commands.executeCommand('workbench.action.files.saveAll');
    } else {
        const savedEvent = createEventHandler(editorProvider.activeEditor!.model!, 'changed', disposables);
        await commands.executeCommand('workbench.action.files.saveAll');

        await waitForCondition(async () => savedEvent.all.some((e) => e.kind === 'save'), 5_000, 'Not saved');
    }
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
    const mockVSC = mock<IVSCodeNotebook>();
    when(mockVSC.notebookEditors).thenReturn([]);
    when(mockVSC.notebookDocuments).thenReturn([]);
    const cellLanguageService = mock<NotebookCellLanguageService>();
    when(cellLanguageService.getPreferredLanguage()).thenReturn(PYTHON_LANGUAGE);

    return new VSCodeNotebookModel(
        trusted,
        uri,
        JSON.parse(JSON.stringify(cells)),
        globalMemento,
        crypto,
        nbJson,
        ' ',
        3,
        instance(mockVSC),
        instance(cellLanguageService)
    );
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
    const cells: NotebookCell[] = [];
    const doc: NotebookDocument = {
        cells,
        version: 1,
        fileName: model.file.fsPath,
        isDirty: false,
        languages: [],
        uri: model.file,
        isUntitled: false,
        viewType,
        contentOptions: {
            transientOutputs: false,
            transientMetadata: {
                breakpointMargin: true,
                editable: true,
                hasExecutionOrder: true,
                inputCollapsed: true,
                lastRunDuration: true,
                outputCollapsed: true,
                runStartTime: true,
                runnable: true,
                executionOrder: false,
                custom: false,
                runState: false,
                statusMessage: false
            }
        },
        metadata: {
            cellEditable: model.isTrusted,
            cellHasExecutionOrder: true,
            cellRunnable: model.isTrusted,
            editable: model.isTrusted,
            runnable: model.isTrusted
        }
    };
    model.cells.forEach((cell, index) => {
        const vscCell = createVSCNotebookCellDataFromCell(model, PYTHON_LANGUAGE, cell)!;
        const vscDocumentCell: NotebookCell = {
            cellKind: vscCell.cellKind,
            language: vscCell.language,
            metadata: vscCell.metadata || {},
            uri: model.file.with({ fragment: `cell${index}` }),
            notebook: doc,
            index,
            document: instance(mock<TextDocument>()),
            outputs: vscCell.outputs
        };
        cells.push(vscDocumentCell);
    });
    model.associateNotebookDocument(doc);
    return doc;
}
