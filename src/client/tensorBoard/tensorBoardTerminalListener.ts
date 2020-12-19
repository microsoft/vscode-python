import { inject, injectable } from 'inversify';
import { Disposable, Terminal, TerminalDataWriteEvent, window } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { IDisposableRegistry } from '../common/types';
import { noop } from '../common/utils/misc';
import { TensorBoardPrompt } from './tensorBoardPrompt';

@injectable()
export class TensorBoardTerminalListener implements IExtensionSingleActivationService {
    private disposable: Disposable;

    private terminalBuffers: WeakMap<Terminal, string[]>;

    constructor(
        @inject(IDisposableRegistry) private disposableRegistry: IDisposableRegistry,
        @inject(TensorBoardPrompt) private prompt: TensorBoardPrompt
    ) {
        this.terminalBuffers = new WeakMap<Terminal, string[]>();
        this.disposable = window.onDidWriteTerminalData(
            (e) => this.handleTerminalInput(e).ignoreErrors(),
            this,
            this.disposableRegistry
        );
    }

    public async activate() {
        // All our work is done in constructor
        noop();
    }

    // This function is called whenever any data is written to a VS Code integrated
    // terminal. It fires onDidRunTensorBoardCommand when the user attempts to launch
    // tensorboard from the active terminal.
    // onDidWriteTerminalData emits raw data being written to the terminal output.
    // TerminalDataWriteEvent.data can be a individual single character as user is typing
    // something into terminal, so this function buffers characters and flushes them on a newline.
    // It can also be a series of characters if the user pastes a command into the terminal
    // or uses terminal history to fetch past commands.
    // It can also fire with multiple characters from terminal prompt characters or terminal output.
    private async handleTerminalInput(e: TerminalDataWriteEvent) {
        if (!window.activeTerminal || window.activeTerminal !== e.terminal) {
            return;
        }

        const { data, terminal } = e;

        // At any given time, this array contains the current line being built
        let buffer = this.terminalBuffers.get(terminal) || [];
        let match = false;

        console.log('Got data', data);
        console.log('Buffer contents are', buffer);

        if (data.match(/[\b]|\^H/)) {
            // On Linux backspaces appear in `data` as ^H
            // Assumption here is that backspaces only get written to terminal output
            // one character at a time
            if (buffer.length > 0) {
                // Handle user backspace
                buffer.pop();
            }
            // If there's nothing in the buffer, backspace is a noop
        } else {
            // `data` here could be a single character, multiple characters,
            // or a multiline string
            const lines = data.splitLines({ trim: true, removeEmptyEntries: false });
            // Combine with any existing buffered characters
            lines[0] = buffer.join('') + lines[0];
            for (const line of lines) {
                // This is admittedly aggressive, it matches if the line contains
                // any mention of tensorboard (e.g. user is in a directory with
                // tensorboard in the name) for increased discoverability
                if (line.includes('tensorboard')) {
                    match = true;
                    break;
                }
            }
            // Hold on to the last fragment for building the next line
            buffer = [lines[lines.length - 1]];
        }

        if (match) {
            this.prompt.showNativeTensorBoardPrompt().ignoreErrors();
            // Once we notify the user of a match, no need to keep listening for writes
            this.disposable.dispose();
        }

        this.terminalBuffers.set(terminal, buffer);
    }
}
