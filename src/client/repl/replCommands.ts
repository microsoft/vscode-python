import {
    commands,
    Uri,
    workspace,
    window,
    NotebookControllerAffinity,
    NotebookEditor,
    TextEditor,
    NotebookDocument,
} from 'vscode';
import { Disposable } from 'vscode-jsonrpc';
import { Commands, PVSC_EXTENSION_ID } from '../common/constants';
import { noop } from '../common/utils/misc';
import { IInterpreterService } from '../interpreter/contracts';
import { NativeRepl } from './nativeRepl';
import {
    executeInTerminal,
    executeNotebookCell,
    openInteractiveREPL,
    selectNotebookKernel,
} from './replCommandHandler';
import {
    getActiveInterpreter,
    getSelectedTextToExecute,
    getSendToNativeREPLSetting,
    insertNewLineToREPLInput,
    isMultiLineText,
} from './replUtils';

let notebookEditor: NotebookEditor | undefined;
let notebookDocument: NotebookDocument | undefined;
let nativeRepl: NativeRepl | undefined;

workspace.onDidCloseNotebookDocument((nb) => {
    if (notebookDocument && nb.uri.toString() === notebookDocument.uri.toString()) {
        notebookEditor = undefined;
        notebookDocument = undefined;
    }
});

/**
 * Registers REPL command for shift+enter if sendToNativeREPL setting is enabled.
 * @param disposables
 * @param interpreterService
 * @returns Promise<void>
 */
export async function registerReplCommands(
    disposables: Disposable[],
    interpreterService: IInterpreterService,
): Promise<void> {
    disposables.push(
        commands.registerCommand(Commands.Exec_In_REPL, async (uri: Uri) => {
            const nativeREPLSetting = getSendToNativeREPLSetting();

            if (!nativeREPLSetting) {
                await executeInTerminal();
                return;
            }

            const interpreter = await getActiveInterpreter(uri, interpreterService);

            if (interpreter) {
                nativeRepl = new NativeRepl(interpreter, disposables);
                const notebookController = nativeRepl.getReplController();

                const activeEditor = window.activeTextEditor as TextEditor;
                const code = await getSelectedTextToExecute(activeEditor);

                notebookEditor = await openInteractiveREPL(notebookController, notebookDocument);
                notebookDocument = notebookEditor.notebook;

                if (notebookDocument) {
                    notebookController.updateNotebookAffinity(notebookDocument, NotebookControllerAffinity.Default);
                    await selectNotebookKernel(notebookEditor, notebookController.id, PVSC_EXTENSION_ID);
                    await executeNotebookCell(notebookDocument, code as string);
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
            const completeCode = nativeRepl?.checkUserInputCompleteCode(window.activeTextEditor);
            const editor = window.activeTextEditor;

            // Execute right away when complete code and Not multi-line
            if (completeCode && !isMultiLineText(editor)) {
                await commands.executeCommand('interactive.execute');
            } else {
                insertNewLineToREPLInput(editor);

                // Handle case when user enters on blank line, just trigger interactive.execute
                if (editor && editor.document.lineAt(editor.selection.active.line).text === '') {
                    await commands.executeCommand('interactive.execute');
                }
            }
        }),
    );
}
