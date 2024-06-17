import { commands, window, NotebookController, NotebookEditor, ViewColumn, NotebookDocument } from 'vscode';
import { Commands } from '../common/constants';
import { addCellToNotebook, getExistingReplViewColumn } from './replUtils';

export async function executeInTerminal(): Promise<void> {
    await commands.executeCommand(Commands.Exec_Selection_In_Terminal);
}

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
