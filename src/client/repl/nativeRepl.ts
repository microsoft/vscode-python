// Native Repl class that holds instance of pythonServer and replController

import { NotebookController, NotebookControllerAffinity, NotebookDocument, TextEditor, workspace } from 'vscode';
import { Disposable } from 'vscode-jsonrpc';
import { PVSC_EXTENSION_ID } from '../common/constants';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { createPythonServer, PythonServer } from './pythonServer';
import { executeNotebookCell, openInteractiveREPL, selectNotebookKernel } from './replCommandHandler';
import { createReplController } from './replController';

export class NativeRepl implements Disposable {
    private pythonServer: PythonServer;

    private interpreter: PythonEnvironment;

    private disposables: Disposable[] = [];

    private replController: NotebookController;

    private notebookDocument: NotebookDocument | undefined;

    // TODO: In the future, could also have attribute of URI for file specific REPL.
    constructor(interpreter: PythonEnvironment) {
        this.interpreter = interpreter;

        this.pythonServer = createPythonServer([interpreter.path as string]);
        this.replController = this.setReplController();

        this.watchNotebookClosed();
    }

    dispose(): void {
        this.disposables.forEach((d) => d.dispose());
    }

    /**
     * Function that watches for Notebook Closed event.
     * This is for the purposes of correctly updating the notebookEditor and notebookDocument on close.
     */
    private watchNotebookClosed(): void {
        this.disposables.push(
            workspace.onDidCloseNotebookDocument((nb) => {
                if (this.notebookDocument && nb.uri.toString() === this.notebookDocument.uri.toString()) {
                    this.notebookDocument = undefined;
                }
            }),
        );
    }

    /**
     * Function that check if NotebookController for REPL exists, and returns it in Singleton manner.
     * @returns NotebookController
     */
    public setReplController(): NotebookController {
        if (!this.replController) {
            return createReplController(this.interpreter.path, this.disposables);
        }
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

    /**
     * Function that opens interactive repl, selects kernel, and send/execute code to the native repl.
     * @param code
     */
    public async sendToNativeRepl(code: string): Promise<void> {
        const notebookEditor = await openInteractiveREPL(this.replController, this.notebookDocument);
        this.notebookDocument = notebookEditor.notebook;

        if (this.notebookDocument) {
            this.replController.updateNotebookAffinity(this.notebookDocument, NotebookControllerAffinity.Default);
            await selectNotebookKernel(notebookEditor, this.replController.id, PVSC_EXTENSION_ID);
            await executeNotebookCell(this.notebookDocument, code);
        }
    }
}

let nativeRepl: NativeRepl | undefined; // In multi REPL scenario, hashmap of URI to Repl.

/**
 * Get Singleton Native REPL Instance
 * @param interpreter
 * @returns Native REPL instance
 */
export function getNativeRepl(interpreter: PythonEnvironment, disposables: Disposable[]): NativeRepl {
    if (!nativeRepl) {
        nativeRepl = new NativeRepl(interpreter);
        disposables.push(nativeRepl);
    }
    return nativeRepl;
}
