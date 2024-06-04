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
import { createPythonServer } from './pythonServer';
import { createReplController } from './replController';
import {
    addCellToNotebook,
    checkUserInputCompleteCode,
    getSelectedTextToExecute,
    getSendToNativeREPLSetting,
    insertNewLineToREPLInput,
} from './replUtils';

let notebookController: NotebookController | undefined;
let notebookEditor: NotebookEditor | undefined;
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
        commands.registerCommand(Commands.Exec_In_REPL, async (uri: Uri) => {
            const nativeREPLSetting = getSendToNativeREPLSetting();

            // If nativeREPLSetting is false(Send to Terminal REPL), then fall back to running in Terminal REPL
            if (!nativeREPLSetting) {
                await commands.executeCommand(Commands.Exec_Selection_In_Terminal);
                return;
            }

            const interpreter = await interpreterService.getActiveInterpreter(uri);
            if (!interpreter) {
                commands.executeCommand(Commands.TriggerEnvironmentSelection, uri).then(noop, noop);
                return;
            }
            if (interpreter) {
                const interpreterPath = interpreter.path;

                if (!notebookController) {
                    notebookController = createReplController(interpreterPath, disposables);
                }
                const activeEditor = window.activeTextEditor as TextEditor;
                const code = await getSelectedTextToExecute(activeEditor);

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

                if (notebookDocument) {
                    notebookController.updateNotebookAffinity(notebookDocument, NotebookControllerAffinity.Default);

                    // Auto-Select Python REPL Kernel
                    await commands.executeCommand('notebook.selectKernel', {
                        notebookEditor,
                        id: notebookController.id,
                        extension: PVSC_EXTENSION_ID,
                    });

                    const { cellCount } = notebookDocument;
                    await addCellToNotebook(notebookDocument, code as string);
                    // Execute the cell
                    commands.executeCommand('notebook.cell.execute', {
                        ranges: [{ start: cellCount, end: cellCount + 1 }],
                        document: notebookDocument.uri,
                    });
                }
            }
        }),
    );
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
            const completeCode = await checkUserInputCompleteCode(window.activeTextEditor, pythonServer);

            const editor = window.activeTextEditor;
            // Execute right away when complete code and Not multi-line
            if (completeCode && !isMultiLineText(editor)) {
                await commands.executeCommand('interactive.execute');
            } else {
                // Insert new line on behalf of user. "Regular" monaco editor behavior
                insertNewLineToREPLInput(editor);

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
