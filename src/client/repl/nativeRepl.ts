// Native Repl class that holds instance of pythonServer and replController

import {
    NotebookController,
    NotebookControllerAffinity,
    NotebookDocument,
    NotebookEditor,
    TextEditor,
    workspace,
} from 'vscode';
import { Disposable } from 'vscode-jsonrpc';
import { PVSC_EXTENSION_ID } from '../common/constants';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { createPythonServer, PythonServer } from './pythonServer';
import { executeNotebookCell, openInteractiveREPL, selectNotebookKernel } from './replCommandHandler';
import { createReplController } from './replController';

export class NativeRepl {
    private pythonServer: PythonServer;

    private interpreter: PythonEnvironment;

    private disposables: Disposable[];

    private replController: NotebookController;

    private notebookDocument: NotebookDocument | undefined;

    private notebookEditor: NotebookEditor | undefined;

    // TODO: In the future, could also have attribute of URI for file specific REPL.
    constructor(interpreter: PythonEnvironment, disposables: Disposable[]) {
        this.interpreter = interpreter;
        this.disposables = disposables;
        this.pythonServer = createPythonServer([interpreter.path as string]);
        this.replController = this.setReplController();

        this.watchNotebookClosed();
    }

    /**
     * Function that watches for Notebook Closed event.
     * This is for the purposes of correctly updating the notebookEditor and notebookDocument on close.
     */
    private watchNotebookClosed(): void {
        workspace.onDidCloseNotebookDocument((nb) => {
            if (this.notebookDocument && nb.uri.toString() === this.notebookDocument.uri.toString()) {
                this.notebookEditor = undefined;
                this.notebookDocument = undefined;
            }
        });
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
        this.notebookEditor = await openInteractiveREPL(this.replController, this.notebookDocument);
        this.notebookDocument = this.notebookEditor.notebook;

        if (this.notebookDocument) {
            this.replController.updateNotebookAffinity(this.notebookDocument, NotebookControllerAffinity.Default);
            await selectNotebookKernel(this.notebookEditor, this.replController.id, PVSC_EXTENSION_ID);
            await executeNotebookCell(this.notebookDocument, code);
        }
    }
}
