import { Disposable, TerminalShellExecutionStartEvent } from 'vscode';
import { onDidStartTerminalShellExecution, showWarningMessage } from '../../common/vscodeApis/windowApis';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { ICommandManager } from '../../common/application/types';
import { Commands } from '../../common/constants';
import { Common, Repl } from '../../common/utils/localize';
import { IExtensionContext } from '../../common/types';
import { getGlobalStorage, getWorkspaceStateValue, updateWorkspaceStateValue } from '../../common/persistentState';

export const SUGGEST_NATIVE_REPL = 'suggestNativeRepl';

export function checkREPLCommand(command: string): boolean {
    const lower = command.toLowerCase().trimStart();
    return lower.startsWith('python') || lower.startsWith('py ');
}

export async function registerTriggerForTerminalREPL(
    commandManager: ICommandManager,
    context: IExtensionContext,
    disposables: Disposable[],
): Promise<void> {
    // When extension reloads via user triggering reloading of VS Code, reset to suggest Native REPL on workspace level.
    await updateWorkspaceStateValue(SUGGEST_NATIVE_REPL, true);
    disposables.push(
        onDidStartTerminalShellExecution(async (e: TerminalShellExecutionStartEvent) => {
            if (e.execution.commandLine.isTrusted && checkREPLCommand(e.execution.commandLine.value)) {
                sendTelemetryEvent(EventName.REPL, undefined, { replType: 'manualTerminal' });

                // Plan:
                // Global memento to disable show of prompt entirely - global memento
                // workspace memento to track and only show suggest of native REPL once.
                const globalSuggestNativeRepl = getGlobalStorage<boolean>(context, SUGGEST_NATIVE_REPL, true);
                const workspaceSuggestNativeRepl = getWorkspaceStateValue<boolean>(SUGGEST_NATIVE_REPL, true);
                if (globalSuggestNativeRepl.get() && workspaceSuggestNativeRepl) {
                    // Prompt user to start Native REPL
                    const selection = await showWarningMessage(
                        Repl.terminalSuggestNativeReplPrompt,
                        'Launch Native REPL',
                        Common.doNotShowAgain,
                    );

                    if (selection === 'Launch Native REPL') {
                        await commandManager.executeCommand(Commands.Start_Native_REPL, undefined);
                    } else {
                        // Update global suggest to disable Native REPL suggestion in future even after reload.
                        await globalSuggestNativeRepl.set(false);
                    }
                }
                // Update workspace native repl suggestion value after the first 'python' in terminal.
                await updateWorkspaceStateValue(SUGGEST_NATIVE_REPL, false);
            }
        }),
    );
}
