/* eslint-disable import/first */
import { inject, injectable } from 'inversify';
import { debounce } from 'lodash';
import * as vscode from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { IDisposableRegistry, IExperimentService } from '../common/types';
import { TensorBoardPrompt } from './tensorBoardPrompt';
import { NativeTensorBoard } from '../common/experiments/groups';
import { isTestExecution } from '../common/constants';
import { TensorBoardLaunchSource } from './constants';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).window = undefined;
// eslint-disable-next-line import/order
import { Terminal } from 'xterm';
@injectable()
export class TensorBoardTerminalListener implements IExtensionSingleActivationService {
    private terminalDataListenerDisposable: vscode.Disposable | undefined;

    private terminal: Terminal;

    constructor(
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(TensorBoardPrompt) private prompt: TensorBoardPrompt,
        @inject(IExperimentService) private experimentService: IExperimentService,
    ) {
        this.terminal = new Terminal({ allowProposedApi: true });
    }

    public async activate(): Promise<void> {
        this.activateInternal().ignoreErrors();
    }

    private async activateInternal() {
        if (isTestExecution() || (await this.experimentService.inExperiment(NativeTensorBoard.experiment))) {
            this.terminalDataListenerDisposable = vscode.window.onDidWriteTerminalData(
                (e) => this.handleTerminalData(e).ignoreErrors(),
                this,
                this.disposableRegistry,
            );
            // Only track and parse the active terminal's data since we only care about user input
            vscode.window.onDidChangeActiveTerminal(() => this.terminal.reset(), this, this.disposableRegistry);
            this.terminal.onCursorMove(debounce(() => this.findTensorBoard(), 5000));
            // Only bother tracking one line at a time
            this.terminal.onLineFeed(() => {
                this.findTensorBoard(this.terminal.buffer.active.cursorY - 1);
                this.terminal.reset();
            });
        }
    }

    private findTensorBoard(row = this.terminal.buffer.active.cursorY) {
        const line = this.terminal.buffer.active.getLine(row);
        const bufferContents = line?.translateToString(false);
        if (bufferContents && bufferContents.includes('tensorboard')) {
            this.complete();
        }
    }

    private complete() {
        this.prompt.showNativeTensorBoardPrompt(TensorBoardLaunchSource.terminal).ignoreErrors();
        // Unsubscribe from terminal data events ASAP
        this.terminalDataListenerDisposable?.dispose();
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
        this.terminal.write(e.data);
    }
}
