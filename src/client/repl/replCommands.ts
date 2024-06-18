import { commands, Uri, window } from 'vscode';
import { Disposable } from 'vscode-jsonrpc';
import { Commands } from '../common/constants';
import { noop } from '../common/utils/misc';
import { IInterpreterService } from '../interpreter/contracts';
import { getNativeRepl } from './nativeRepl';
import {
    executeInTerminal,
    getActiveInterpreter,
    getSelectedTextToExecute,
    getSendToNativeREPLSetting,
    insertNewLineToREPLInput,
    isMultiLineText,
} from './replUtils';

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
                const nativeRepl = getNativeRepl(interpreter, disposables);
                const activeEditor = window.activeTextEditor;
                if (activeEditor) {
                    const code = await getSelectedTextToExecute(activeEditor);
                    if (code) {
                        await nativeRepl.sendToNativeRepl(code);
                    }
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

            const nativeRepl = getNativeRepl(interpreter, disposables);
            const completeCode = await nativeRepl?.checkUserInputCompleteCode(window.activeTextEditor);
            const editor = window.activeTextEditor;

            if (editor) {
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
            }
        }),
    );
}
