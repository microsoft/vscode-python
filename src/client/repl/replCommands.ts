import {
    commands,
    NotebookController,
    Uri,
    workspace,
    window,
    NotebookControllerAffinity,
    ViewColumn,
    NotebookEdit,
    NotebookCellData,
    NotebookCellKind,
    WorkspaceEdit,
    NotebookEditor,
    TextEditor,
    Selection,
    NotebookDocument,
} from 'vscode';
import { Disposable } from 'vscode-jsonrpc';
import { Commands, PVSC_EXTENSION_ID } from '../common/constants';
import { noop } from '../common/utils/misc';
import { IInterpreterService } from '../interpreter/contracts';
import { getMultiLineSelectionText, getSingleLineSelectionText } from '../terminals/codeExecution/helper';
import { createPythonServer } from './pythonServer';
import { createReplController } from './replController';
import { getActiveResource } from '../common/vscodeApis/windowApis';
import { getConfiguration } from '../common/vscodeApis/workspaceApis';
import { ExecCommandHandler } from './replCommandHandlers';

let notebookController: NotebookController | undefined;
let notebookEditor: NotebookEditor | undefined;
// TODO: figure out way to put markdown telling user kernel has been dead and need to pick again.
let notebookDocument: NotebookDocument | undefined;

workspace.onDidCloseNotebookDocument((nb) => {
    if (notebookDocument && nb.uri.toString() === notebookDocument.uri.toString()) {
        notebookEditor = undefined;
        notebookDocument = undefined;
    }
});

// Will only be called when user has experiment enabled.
export async function registerReplCommands(
    disposables: Disposable[],
    interpreterService: IInterpreterService,
): Promise<void> {
    disposables.push(
        commands.registerCommand(Commands.Exec_In_REPL, new ExecCommandHandler(interpreterService).execute),
    );
}
/**
 * Function that adds cell to notebook.
 * This function will only get called when notebook document is defined.
 * @param code
 *
 */
async function addCellToNotebook(code: string): Promise<void> {
    const notebookCellData = new NotebookCellData(NotebookCellKind.Code, code as string, 'python');
    const { cellCount } = notebookDocument!;
    // Add new cell to interactive window document
    const notebookEdit = NotebookEdit.insertCells(cellCount, [notebookCellData]);
    const workspaceEdit = new WorkspaceEdit();
    workspaceEdit.set(notebookDocument!.uri, [notebookEdit]);
    await workspace.applyEdit(workspaceEdit);
}

/**
 * Command triggered for 'Enter': Conditionally call interactive.execute OR insert \n in text input box.
 * @param disposables
 * @param interpreterService
 */
export async function registerReplExecuteOnEnter(
    disposables: Disposable[],
    interpreterService: IInterpreterService,
): Promise<void> {
    disposables.push(
        commands.registerCommand(Commands.Exec_In_REPL_Enter, async (uri: Uri) => {
            const interpreter = await interpreterService.getActiveInterpreter(uri);
            if (!interpreter) {
                commands.executeCommand(Commands.TriggerEnvironmentSelection, uri).then(noop, noop);
                return;
            }

            // Create Separate Python server to check valid command
            const pythonServer = createPythonServer([interpreter.path as string]);

            const activeEditor = window.activeTextEditor;
            let userTextInput;
            let completeCode = false;

            if (activeEditor) {
                const { document } = activeEditor;
                userTextInput = document.getText();
            }

            // Check if userTextInput is a complete Python command
            if (userTextInput) {
                completeCode = await pythonServer.checkValidCommand(userTextInput);
            }
            const editor = window.activeTextEditor;
            // Execute right away when complete code and Not multi-line
            if (completeCode && !isMultiLineText(editor)) {
                await commands.executeCommand('interactive.execute');
            } else {
                // Insert new line on behalf of user. "Regular" monaco editor behavior
                if (editor) {
                    const position = editor.selection.active;
                    const newPosition = position.with(position.line, editor.document.lineAt(position.line).text.length);
                    editor.selection = new Selection(newPosition, newPosition);

                    editor.edit((editBuilder) => {
                        editBuilder.insert(newPosition, '\n');
                    });
                }

                // Handle case when user enters on blank line, just trigger interactive.execute
                if (editor && editor.document.lineAt(editor.selection.active.line).text === '') {
                    await commands.executeCommand('interactive.execute');
                }
            }
        }),
    );
}

function isMultiLineText(textEditor: TextEditor | undefined): boolean {
    return (textEditor?.document?.lineCount ?? 0) > 1;
}
