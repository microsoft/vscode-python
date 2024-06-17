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
    let notebookEditor: NotebookEditor | undefined;

    // Case where NotebookDocument (REPL document already exists in the tab)
    if (notebookDocument) {
        const existingReplViewColumn = getExistingReplViewColumn(notebookDocument);
        const replViewColumn = existingReplViewColumn ?? ViewColumn.Beside;
        notebookEditor = await window.showNotebookDocument(notebookDocument!, { viewColumn: replViewColumn });
    } else if (!notebookDocument) {
        // Case where NotebookDocument doesnt exist, open new REPL tab
        const interactiveWindowObject = (await commands.executeCommand(
            'interactive.open',
            {
                preserveFocus: true,
                viewColumn: ViewColumn.Beside,
            },
            undefined,
            notebookController.id,
            'Python REPL',
        )) as { notebookEditor: NotebookEditor };
        notebookEditor = interactiveWindowObject.notebookEditor;
        notebookDocument = interactiveWindowObject.notebookEditor.notebook;
    }
    return notebookEditor!;
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
        ranges: [{ start: cellCount, end: cellCount + 1 }],
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
    const notebookEdit = NotebookEdit.insertCells(cellCount, [notebookCellData]);
    const workspaceEdit = new WorkspaceEdit();
    workspaceEdit.set(notebookDocument!.uri, [notebookEdit]);
    await workspace.applyEdit(workspaceEdit);
}
