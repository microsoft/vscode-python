import { commands, window, NotebookController, NotebookEditor, ViewColumn, NotebookDocument } from 'vscode';
import { Commands } from '../common/constants';

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
    notebookEditor: NotebookEditor | undefined,
): Promise<NotebookEditor> {
    let notebookDocument: NotebookDocument | undefined;

    if (!notebookEditor) {
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
    // Handle case where user has closed REPL window, and re-opens.
    if (notebookEditor && notebookDocument) {
        await window.showNotebookDocument(notebookDocument, { viewColumn: ViewColumn.Beside });
    }
    return notebookEditor;
}
