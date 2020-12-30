import { inject, injectable } from 'inversify';
import { Disposable, TerminalDataWriteEvent, window } from 'vscode';
import { debounce } from 'lodash';
import { IExtensionSingleActivationService } from '../activation/types';
import { IDisposableRegistry, IExperimentService } from '../common/types';
import { TensorBoardPrompt } from './tensorBoardPrompt';
import { NativeTensorBoard } from '../common/experiments/groups';
import { isTestExecution } from '../common/constants';
import { CoreTerminal } from './terminal/CoreTerminal';
import { TensorBoardLaunchSource } from './constants';
@injectable()
export class TensorBoardTerminalListener extends CoreTerminal implements IExtensionSingleActivationService {
    private terminalDataListenerDisposable: Disposable | undefined;

    constructor(
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(TensorBoardPrompt) private prompt: TensorBoardPrompt,
        @inject(IExperimentService) private experimentService: IExperimentService,
    ) {
        super({});
    }

    public async activate(): Promise<void> {
        this.activateInternal().ignoreErrors();
    }

    private async activateInternal() {
        if (isTestExecution() || (await this.experimentService.inExperiment(NativeTensorBoard.experiment))) {
            this.terminalDataListenerDisposable = window.onDidWriteTerminalData(
                (e) => this.handleTerminalData(e).ignoreErrors(),
                this,
                this.disposableRegistry,
            );
            // Only track and parse the active terminal's data since we only care about user input
            window.onDidChangeActiveTerminal(() => this.reset(), this, this.disposableRegistry);
            this._inputHandler.onCursorMove(debounce(() => this.findTensorBoard(), 5000));
            // Only bother tracking one line at a time
            this._inputHandler.onLineFeed(() => {
                this.findTensorBoard(this._bufferService.buffer.y - 1);
                this.reset();
            });
        }
    }

    private findTensorBoard(row = this._bufferService.buffer.y) {
        const bufferContents = this._bufferService.buffer.translateBufferLineToString(row, false);
        if (bufferContents.includes('tensorboard')) {
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
    private async handleTerminalData(e: TerminalDataWriteEvent) {
        if (!window.activeTerminal || window.activeTerminal !== e.terminal) {
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
        this.writeSync(e.data);
    }
}
