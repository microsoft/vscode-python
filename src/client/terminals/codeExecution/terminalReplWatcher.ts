import { Disposable, TerminalShellExecutionStartEvent } from 'vscode';
import { onDidStartTerminalShellExecution } from '../../common/vscodeApis/windowApis';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';

function checkREPLCommand(command: string): boolean {
    const lower = command.toLowerCase();
    // Cover cases for 'py', 'py -3' and 'py -3.x'.
    const replCommandRegex = /^py(?:\s-3(?:\.\d)?)?$/;
    return lower.startsWith('python') || lower.startsWith('python3') || replCommandRegex.test(command);
}

export function registerTriggerForTerminalREPL(disposables: Disposable[]): void {
    disposables.push(
        onDidStartTerminalShellExecution(async (e: TerminalShellExecutionStartEvent) => {
            if (e.execution.commandLine.isTrusted && checkREPLCommand(e.execution.commandLine.value)) {
                sendTelemetryEvent(EventName.REPL, undefined, { replType: 'Terminal' });
            }
        }),
    );
}
