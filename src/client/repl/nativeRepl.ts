// Native Repl class that holds instance of pythonServer and replController

import { NotebookController, TextEditor } from 'vscode';
import { Disposable } from 'vscode-jsonrpc';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { createPythonServer, PythonServer } from './pythonServer';
import { getReplController } from './replController';

// Each REPL class would have their own REPL controller and Python Server.
export class NativeRepl {
    private pythonServer: PythonServer;

    private interpreter: PythonEnvironment;

    private disposables: Disposable[];

    private replController: NotebookController;

    // Could also have attribute of URI for file specific REPL.
    constructor(interpreter: PythonEnvironment, disposables: Disposable[]) {
        this.interpreter = interpreter;
        this.disposables = disposables;
        this.pythonServer = createPythonServer([interpreter.path as string]);
        this.replController = getReplController(interpreter, disposables); // currently single repl controller
    }

    public getPythonServer(): PythonServer {
        return this.pythonServer;
    }

    public getReplController(): NotebookController {
        return this.replController;
    }

    /**
     * Function that checks if native REPL's text input box contains complete code.
     * @param activeEditor
     * @param pythonServer
     * @returns Promise<boolean> - True if complete/Valid code is present, False otherwise.
     */
    public async checkUserInputCompleteCode(activeEditor: TextEditor | undefined): Promise<boolean> {
        let completeCode = false;
        let userTextInput;
        if (activeEditor) {
            const { document } = activeEditor;
            userTextInput = document.getText();
        }

        // Check if userTextInput is a complete Python command
        if (userTextInput) {
            completeCode = await this.pythonServer.checkValidCommand(userTextInput);
        }

        return completeCode;
    }
}
