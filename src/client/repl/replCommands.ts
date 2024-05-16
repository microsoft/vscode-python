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
} from 'vscode';
import { Disposable } from 'vscode-jsonrpc';
import { Commands, PVSC_EXTENSION_ID } from '../common/constants';
import { noop } from '../common/utils/misc';
import { IInterpreterService } from '../interpreter/contracts';
import { getMultiLineSelectionText, getSingleLineSelectionText } from '../terminals/codeExecution/helper';
import { createReplController } from './replController';

let notebookController: NotebookController | undefined;
let notebookEditor: NotebookEditor | undefined;
// TODO: figure out way to put markdown telling user kernel has been dead and need to pick again.

async function getSelectedTextToExecute(textEditor: TextEditor): Promise<string | undefined> {
    if (!textEditor) {
        return undefined;
    }

    const { selection } = textEditor;
    let code: string;

    if (selection.isEmpty) {
        code = textEditor.document.lineAt(selection.start.line).text;
    } else if (selection.isSingleLine) {
        code = getSingleLineSelectionText(textEditor);
    } else {
        code = getMultiLineSelectionText(textEditor);
    }

    return code;
}

export async function registerReplCommands(
    disposables: Disposable[],
    interpreterService: IInterpreterService,
): Promise<void> {
    disposables.push(
        commands.registerCommand(Commands.Exec_In_REPL, async (uri: Uri) => {
            const interpreter = await interpreterService.getActiveInterpreter(uri);
            if (!interpreter) {
                commands.executeCommand(Commands.TriggerEnvironmentSelection, uri).then(noop, noop);
                return;
            }
            if (interpreter) {
                const interpreterPath = interpreter.path;

                if (!notebookController) {
                    notebookController = createReplController(interpreterPath);
                }
                const activeEditor = window.activeTextEditor as TextEditor;

                const code = await getSelectedTextToExecute(activeEditor);
                const ourResource = Uri.from({ scheme: 'untitled', path: 'repl.interactive' });

                const notebookDocument = await workspace.openNotebookDocument(ourResource);
                // commands.executeCommand('_interactive.open'); command to open interactive window so intellisense is registered.

                // We want to keep notebookEditor, whenever we want to run.
                // Find interactive window, or open it.
                if (!notebookEditor) {
                    notebookEditor = await window.showNotebookDocument(notebookDocument, {
                        viewColumn: ViewColumn.Beside,
                    });
                }

                notebookController!.updateNotebookAffinity(notebookDocument, NotebookControllerAffinity.Default);

                // Auto-Select Python REPL Kernel
                await commands.executeCommand('notebook.selectKernel', {
                    notebookEditor,
                    id: notebookController?.id,
                    extension: PVSC_EXTENSION_ID,
                });

                const notebookCellData = new NotebookCellData(NotebookCellKind.Code, code as string, 'python');
                const { cellCount } = notebookDocument;
                // Add new cell to interactive window document
                const notebookEdit = NotebookEdit.insertCells(cellCount, [notebookCellData]);
                const workspaceEdit = new WorkspaceEdit();
                workspaceEdit.set(notebookDocument.uri, [notebookEdit]);
                await workspace.applyEdit(workspaceEdit);

                // Execute the cell
                commands.executeCommand('notebook.cell.execute', {
                    ranges: [{ start: cellCount, end: cellCount + 1 }],
                    document: ourResource,
                });
            }
        }),
    );
}

// Register Python execute command for keybinding 'Enter'
// Conditionally call interactive.execute OR insert \n in text input box.
export async function registerReplExecuteOnEnter(disposables: Disposable[]): Promise<void> {
    disposables.push(
        commands.registerCommand(Commands.Exec_In_REPL_Enter, async (uri: Uri) => {
            const completeCode = false;
            const uri2 = uri;
            if (completeCode) {
                await commands.executeCommand('interactive.execute');
            } else {
                // Insert new line on behalf of user. "Regular" monaco editor behavior
                const editor = window.activeTextEditor;
                if (editor) {
                    const position = editor.selection.active;
                    // move cursor to end of line and also add newline character
                    const newPosition = position.with(position.line, editor.document.lineAt(position.line).text.length);
                    editor.selection = new Selection(newPosition, newPosition);
                    // add newline character
                    editor.edit((editBuilder) => {
                        editBuilder.insert(newPosition, '\n');
                    });
                }

                // If user types enter on blank line, call interactive.execute
                if (editor && editor.document.lineAt(editor.selection.active.line).text === '') {
                    await commands.executeCommand('interactive.execute');
                }
            }
        }), // This closing parenthesis was missing.
    );
    // Handle case when user enters on blank line, just trigger interactive.execute
}
