/* eslint-disable import/first */
import { inject, injectable } from 'inversify';
import * as vscode from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { IDisposableRegistry, IExperimentService } from '../common/types';
import { TensorBoardPrompt } from './tensorBoardPrompt';
import { NativeTensorBoard } from '../common/experiments/groups';
import { isTestExecution } from '../common/constants';
import { TensorBoardLaunchSource } from './constants';
// This is a necessary hack for the xterm npm package to load, because
// it currently expects to be loaded in the browser context and not in Node.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).window = undefined;
// Import from xterm only after setting the global window variable to
// prevent a ReferenceError being thrown.
// eslint-disable-next-line import/order
import { Terminal } from 'xterm';

@injectable()
export class TensorBoardTerminalListener implements IExtensionSingleActivationService {
    private disposables: vscode.Disposable[] = [];

    private terminal: Terminal | undefined;

    constructor(
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(TensorBoardPrompt) private prompt: TensorBoardPrompt,
        @inject(IExperimentService) private experimentService: IExperimentService,
    ) {}

    public async activate(): Promise<void> {
        this.activateInternal().ignoreErrors();
    }

    private async activateInternal() {
        if (isTestExecution() || (await this.experimentService.inExperiment(NativeTensorBoard.experiment))) {
            const terminal = new Terminal({ allowProposedApi: true });

            this.disposables.push(terminal);
            this.disposables.push(
                vscode.window.onDidWriteTerminalData((e) => this.handleTerminalData(e).ignoreErrors(), this),
            );
            // Only track and parse the active terminal's data since we only care about user input
            this.disposables.push(vscode.window.onDidChangeActiveTerminal(() => terminal.reset(), this));
            this.disposables.push(terminal.onCursorMove(() => this.findTensorBoard(terminal.buffer.active.cursorY)));
            // Only bother tracking one line at a time
            this.disposables.push(
                terminal.onLineFeed(() => {
                    this.findTensorBoard(terminal.buffer.active.cursorY - 1);
                    terminal.reset();
                }),
            );
            // Add all our disposables to the extension's disposable registry.
            // We will dispose ourselves as soon as we see a matching terminal
            // command or when the extension as a whole is disposed, whichever
            // happens first
            this.disposableRegistry.push(...this.disposables);

            this.terminal = terminal;
        }
    }

    private findTensorBoard(row: number) {
        const line = this.terminal?.buffer.active.getLine(row);
        const bufferContents = line?.translateToString(false);
        if (bufferContents && bufferContents.includes('tensorboard')) {
            this.complete();
        }
    }

    private complete() {
        this.prompt.showNativeTensorBoardPrompt(TensorBoardLaunchSource.terminal).ignoreErrors();
        // Unsubscribe from terminal data events ASAP
        this.disposables.forEach((d) => {
            d.dispose();
        });
    }

    // This function is called whenever any data is written to a VS Code integrated
    // terminal. It shows our tensorboard prompt when the user attempts to launch
    // tensorboard from the active terminal.
    // onDidWriteTerminalData emits raw data being written to the terminal output.
    // TerminalDataWriteEvent.data can be a individual single character as user is typing
    // something into terminal. It can also be a series of characters if the user pastes
    // a command into the terminal or uses terminal history to fetch past commands.
    // It can also fire with multiple characters from terminal prompt characters or terminal output.
    private async handleTerminalData(e: vscode.TerminalDataWriteEvent) {
        if (!vscode.window.activeTerminal || vscode.window.activeTerminal !== e.terminal) {
            return;
        }
        // In the case of terminal scrollback or a pasted command, we might be lucky enough
        // to get the whole command in e.data without having to feed it through the parser
        if (e.data.includes('tensorboard')) {
            this.complete();
            return;
        }
        // If the user is entering one character at a time, we'll need to buffer individual characters
        // and handle escape sequences which manipulate the position of the cursor in the buffer
        this.terminal?.write(e.data);
    }
}
