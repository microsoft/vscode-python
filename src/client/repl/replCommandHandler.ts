import {
    commands,
    window,
    NotebookController,
    NotebookEditor,
    ViewColumn,
    NotebookDocument,
    NotebookCellData,
    NotebookCellKind,
    NotebookEdit,
    WorkspaceEdit,
    workspace,
} from 'vscode';
import { getExistingReplViewColumn } from './replUtils';
import { PVSC_EXTENSION_ID } from '../common/constants';

/**
 * Function that opens/show REPL using IW UI.
 */
export async function openInteractiveREPL(
    notebookController: NotebookController,
    notebookDocument: NotebookDocument | undefined,
    preserveFocus: boolean = true,
): Promise<NotebookEditor> {
    let viewColumn = ViewColumn.Beside;

    // Case where NotebookDocument (REPL document already exists in the tab)
    if (notebookDocument) {
        const existingReplViewColumn = getExistingReplViewColumn(notebookDocument);
        viewColumn = existingReplViewColumn ?? viewColumn;
    } else if (!notebookDocument) {
        // Case where NotebookDocument doesnt exist, create a blank one.
        notebookDocument = await workspace.openNotebookDocument('jupyter-notebook');
    }
    const editor = window.showNotebookDocument(notebookDocument!, {
        viewColumn,
        asRepl: 'Python REPL',
        preserveFocus,
    });
    await commands.executeCommand('notebook.selectKernel', {
        editor,
        id: notebookController.id,
        extension: PVSC_EXTENSION_ID,
    });

    return editor;
}

/**
 * Function that selects notebook Kernel.
 */
export async function selectNotebookKernel(
    notebookEditor: NotebookEditor,
    notebookControllerId: string,
    extensionId: string,
): Promise<void> {
    await commands.executeCommand('notebook.selectKernel', {
        notebookEditor,
        id: notebookControllerId,
        extension: extensionId,
    });
}

/**
 * Function that executes notebook cell given code.
 */
export async function executeNotebookCell(notebookEditor: NotebookEditor, code: string): Promise<void> {
    const { notebook, replOptions } = notebookEditor;
    const cellIndex = replOptions?.appendIndex ?? notebook.cellCount;
    await addCellToNotebook(notebook, cellIndex, code);
    // Execute the cell
    commands.executeCommand('notebook.cell.execute', {
        ranges: [{ start: cellIndex, end: cellIndex + 1 }],
        document: notebook.uri,
    });
}

/**
 * Function that adds cell to notebook.
 * This function will only get called when notebook document is defined.
 */
async function addCellToNotebook(notebookDocument: NotebookDocument, index: number, code: string): Promise<void> {
    const notebookCellData = new NotebookCellData(NotebookCellKind.Code, code as string, 'python');
    // Add new cell to interactive window document
    const notebookEdit = NotebookEdit.insertCells(index, [notebookCellData]);
    const workspaceEdit = new WorkspaceEdit();
    workspaceEdit.set(notebookDocument!.uri, [notebookEdit]);
    await workspace.applyEdit(workspaceEdit);
}
