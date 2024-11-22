import { Disposable, TerminalShellExecutionStartEvent } from 'vscode';
import { onDidStartTerminalShellExecution } from '../../common/vscodeApis/windowApis';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { ICommandManager } from '../../common/application/types';
import { Commands } from '../../common/constants';

export function checkREPLCommand(command: string): boolean {
    const lower = command.toLowerCase().trimStart();
    return lower.startsWith('python') || lower.startsWith('py ');
}

export async function registerTriggerForTerminalREPL(
    commandManager: ICommandManager,
    disposables: Disposable[],
): Promise<void> {
    disposables.push(
        onDidStartTerminalShellExecution(async (e: TerminalShellExecutionStartEvent) => {
            if (e.execution.commandLine.isTrusted && checkREPLCommand(e.execution.commandLine.value)) {
                sendTelemetryEvent(EventName.REPL, undefined, { replType: 'manualTerminal' });
                // TODO: Prompt user to start Native REPL

                // If yes, then launch native REPL
                await commandManager.executeCommand(Commands.Start_Native_REPL, undefined);

                // TODO: Decide whether we want everytime, or once per workspace, or once per terminal
                // How do I even track all terminal instances.
            }
        }),
    );
}
