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
 * @param notebookController
 * @param notebookEditor
 * @returns notebookEditor
 */
export async function openInteractiveREPL(
    notebookController: NotebookController,
    notebookDocument: NotebookDocument | undefined,
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
    const editor = window.showNotebookDocument(notebookDocument!, { viewColumn, asRepl: true, label: 'Python REPL' });
    await commands.executeCommand('notebook.selectKernel', {
        editor,
        id: notebookController.id,
        extension: PVSC_EXTENSION_ID,
    });

    return editor;
}

/**
 * Function that selects notebook Kernel.
 * @param notebookEditor
 * @param notebookControllerId
 * @param extensionId
 * @return Promise<void>
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
 * @param notebookDocument
 * @param code
 * @return Promise<void>
 */
export async function executeNotebookCell(notebookDocument: NotebookDocument, code: string): Promise<void> {
    const { cellCount } = notebookDocument;
    await addCellToNotebook(notebookDocument, code);
    // Execute the cell
    commands.executeCommand('notebook.cell.execute', {
        ranges: [{ start: cellCount - 1, end: cellCount }],
        document: notebookDocument.uri,
    });
}

/**
 * Function that adds cell to notebook.
 * This function will only get called when notebook document is defined.
 * @param code
 *
 */
async function addCellToNotebook(notebookDocument: NotebookDocument, code: string): Promise<void> {
    const notebookCellData = new NotebookCellData(NotebookCellKind.Code, code as string, 'python');
    const { cellCount } = notebookDocument!;
    // Add new cell to interactive window document
    const notebookEdit = NotebookEdit.insertCells(cellCount - 1, [notebookCellData]);
    const workspaceEdit = new WorkspaceEdit();
    workspaceEdit.set(notebookDocument!.uri, [notebookEdit]);
    await workspace.applyEdit(workspaceEdit);
}
