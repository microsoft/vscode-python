import { Disposable, TerminalShellExecutionStartEvent } from 'vscode';
import { onDidStartTerminalShellExecution } from '../../common/vscodeApis/windowApis';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';

function checkREPLCommand(command: string): undefined | 'manualTerminal' | `runningScript` | 'runningTest' {
    const lower = command.toLowerCase().trimStart();

    // Check for test commands
    if (
        lower.includes('pytest') ||
        (lower.startsWith('python') && (lower.includes(' -m pytest') || lower.includes(' -m unittest'))) ||
        (lower.startsWith('py ') && (lower.includes(' -m pytest') || lower.includes(' -m unittest'))) ||
        lower.includes('py.test')
    ) {
        return 'runningTest';
    }

    // Regular Python commands
    if (lower.startsWith('python') || lower.startsWith('py ')) {
        const parts = lower.split(' ');
        if (parts.length === 1) {
            return 'manualTerminal';
        }
        return 'runningScript';
    }
    return undefined;
}

export function registerTriggerForTerminalREPL(disposables: Disposable[]): void {
    disposables.push(
        onDidStartTerminalShellExecution(async (e: TerminalShellExecutionStartEvent) => {
            const replType = checkREPLCommand(e.execution.commandLine.value);
            if (e.execution.commandLine.isTrusted && replType) {
                // Send test-specific telemetry if it's a test command
                if (replType === 'runningTest') {
                    sendTelemetryEvent(EventName.UNITTEST_RUN_CLI);
                } else {
                    sendTelemetryEvent(EventName.REPL, undefined, { replType });
                }
            }
        }),
    );
}
