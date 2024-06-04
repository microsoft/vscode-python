import * as vscode from 'vscode';
import { Disposable } from 'vscode-jsonrpc';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { createPythonServer } from './pythonServer';

let notebookController: vscode.NotebookController | undefined;

export function createReplController(
    interpreterPath: string,
    disposables: vscode.Disposable[],
): vscode.NotebookController {
    const server = createPythonServer([interpreterPath]);
    disposables.push(server);

    const controller = vscode.notebooks.createNotebookController('pythonREPL', 'interactive', 'Python REPL');
    controller.supportedLanguages = ['python'];
    controller.supportsExecutionOrder = true;

    controller.description = 'Python REPL';

    controller.interruptHandler = async () => {
        server.interrupt();
    };

    controller.executeHandler = async (cells) => {
        for (const cell of cells) {
            const exec = controller.createNotebookCellExecution(cell);
            exec.start(Date.now());
            try {
                const result = await server.execute(cell.document.getText());

                exec.replaceOutput([
                    new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.text(result, 'text/plain')]),
                ]);
                exec.end(true);
            } catch (err) {
                const error = err as Error;
                exec.replaceOutput([
                    new vscode.NotebookCellOutput([
                        vscode.NotebookCellOutputItem.error({
                            name: error.name,
                            message: error.message,
                            stack: error.stack,
                        }),
                    ]),
                ]);
                exec.end(false);
            }
        }
    };
    disposables.push(controller);
    return controller;
}

export function getReplController(
    interpreter: PythonEnvironment,
    disposables: Disposable[],
): vscode.NotebookController {
    if (!notebookController) {
        notebookController = createReplController(interpreter.path, disposables);
    }
    return notebookController;
}
