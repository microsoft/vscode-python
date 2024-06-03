import { commands, Uri, window, Selection, NotebookController, NotebookEditor, NotebookDocument } from 'vscode';
import { Commands } from '../common/constants';
import { noop } from '../common/utils/misc';
import { IInterpreterService } from '../interpreter/contracts';
import { createPythonServer } from './pythonServer';
import { getSendToNativeREPLSetting, getSelectedTextToExecute } from './replUtils';

export interface IReplExecHandler {
    interpreterService: IInterpreterService;
    notebookController: NotebookController | undefined;
    notebookEditor: NotebookEditor | undefined;
    notebookDocument: NotebookDocument | undefined;
    execute(uri: Uri): Promise<void>;
}

export class ExecCommandHandler implements IReplExecHandler {
    interpreterService: IInterpreterService;

    constructor(interpreterService: IInterpreterService) {
        this.interpreterService = interpreterService;
    }

    async execute(uri: Uri): Promise<void> {
        const nativeREPLSetting = getSendToNativeREPLSetting();

        // If nativeREPLSetting is false(Send to Terminal REPL), then fall back to running in Terminal REPL
        if (!nativeREPLSetting) {
            await commands.executeCommand(Commands.Exec_Selection_In_Terminal);
            return;
        }

        const interpreter = await this.interpreterService.getActiveInterpreter(uri);
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
                await addCellToNotebook(code as string);
                // Execute the cell
                commands.executeCommand('notebook.cell.execute', {
                    ranges: [{ start: cellCount, end: cellCount + 1 }],
                    document: notebookDocument.uri,
                });
            }
        }
    }
}
