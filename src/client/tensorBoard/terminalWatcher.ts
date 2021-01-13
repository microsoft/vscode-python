import { inject, injectable } from 'inversify';
import { window } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { IDisposable, IDisposableRegistry } from '../common/types';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';

// Every 5 min look, through active terminals to see if any are running `tensorboard`
@injectable()
export class TerminalWatcher implements IExtensionSingleActivationService, IDisposable {
    private handle: NodeJS.Timeout | undefined;

    constructor(@inject(IDisposableRegistry) private disposables: IDisposableRegistry) {}

    public async activate(): Promise<void> {
        const handle = setInterval(() => {
            // When user runs a command in VSCode terminal, the terminal's name
            // becomes the program that is currently running. Since tensorboard
            // stays running in the terminal while the webapp is running and
            // until the user kills it, the terminal with the updated name should
            // stick around for long enough that we only need to run this check
            // every 5 min or so
            const matches = window.terminals.filter((terminal) => terminal.name === 'tensorboard');
            if (matches.length > 0) {
                sendTelemetryEvent(EventName.TENSORBOARD_DETECTED_IN_INTEGRATED_TERMINAL);
                clearInterval(handle); // Only need telemetry sent once per VS Code session
            }
        }, 300_000);
        this.handle = handle;
        this.disposables.push(this);
    }

    public dispose(): void {
        if (this.handle) {
            clearInterval(this.handle);
        }
    }
}
