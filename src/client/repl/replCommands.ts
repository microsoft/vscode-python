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
import { IActiveResourceService } from '../common/application/types';
import { Commands, PVSC_EXTENSION_ID } from '../common/constants';
import { IConfigurationService } from '../common/types';
import { noop } from '../common/utils/misc';
import { IInterpreterService } from '../interpreter/contracts';
import { getMultiLineSelectionText, getSingleLineSelectionText } from '../terminals/codeExecution/helper';
import { createPythonServer } from './pythonServer';
import { createReplController } from './replController';

let notebookController: NotebookController | undefined;
let notebookEditor: NotebookEditor | undefined;
// TODO: figure out way to put markdown telling user kernel has been dead and need to pick again.
let notebookDocument: NotebookDocument | undefined;

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

// Will only be called when user has experiment enabled.
export async function registerReplCommands(
    disposables: Disposable[],
    interpreterService: IInterpreterService,
    configurationService: IConfigurationService,
    activeResourceService: IActiveResourceService,
): Promise<void> {
    disposables.push(
        commands.registerCommand(Commands.Exec_In_REPL, async (uri: Uri) => {
            let nativeREPLSetting = false;

            // Get REPL setting value from user settings
            if (configurationService) {
                const pythonSettings = configurationService.getSettings(activeResourceService.getActiveResource());
                nativeREPLSetting = pythonSettings.REPL.sendToNativeREPL;
                // If nativeREPLSetting is false(Send to Terminal REPL), then fall back to running in Terminal REPL
                if (!nativeREPLSetting) {
                    await commands.executeCommand(Commands.Exec_Selection_In_Terminal);
                    return;
                }
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

                // We want to keep notebookEditor, whenever we want to run.
                // Find interactive window, or open it.
                let interactiveWindowObject;

                if (!notebookEditor) {
                    interactiveWindowObject = (await commands.executeCommand(
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

                notebookController!.updateNotebookAffinity(notebookDocument!, NotebookControllerAffinity.Default);

                // Auto-Select Python REPL Kernel
                await commands.executeCommand('notebook.selectKernel', {
                    notebookEditor,
                    id: notebookController?.id,
                    extension: PVSC_EXTENSION_ID,
                });

                const notebookCellData = new NotebookCellData(NotebookCellKind.Code, code as string, 'python');
                const { cellCount } = notebookDocument!;
                // Add new cell to interactive window document
                const notebookEdit = NotebookEdit.insertCells(cellCount, [notebookCellData]);
                const workspaceEdit = new WorkspaceEdit();
                workspaceEdit.set(notebookDocument!.uri, [notebookEdit]);
                await workspace.applyEdit(workspaceEdit);

                // Execute the cell
                commands.executeCommand('notebook.cell.execute', {
                    ranges: [{ start: cellCount, end: cellCount + 1 }],
                    // document: ourResource,
                    document: notebookDocument!.uri,
                });
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
            const pythonServer = createPythonServer([interpreter!.path! as string]);

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
