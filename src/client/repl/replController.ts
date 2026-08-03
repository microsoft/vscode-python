import * as vscode from 'vscode';
import { createPythonServer } from './pythonServer';

export function createReplController(
    interpreterPath: string,
    disposables: vscode.Disposable[],
    cwd?: string,
): vscode.NotebookController {
    const server = createPythonServer([interpreterPath], cwd);
    disposables.push(server);

    const controller = vscode.notebooks.createNotebookController('pythonREPL', 'jupyter-notebook', 'Python REPL');
    controller.supportedLanguages = ['python'];

    controller.description = 'Python REPL';

    controller.interruptHandler = async () => {
        server.interrupt();
    };

    controller.executeHandler = async (cells) => {
        for (const cell of cells) {
            const exec = controller.createNotebookCellExecution(cell);
            exec.start(Date.now());

            const code = cell.document.getText();
            const result = await server.execute(code);

            if (result?.output) {
                const stdoutItem = vscode.NotebookCellOutputItem.stdout(result.output);
                (stdoutItem as any).metadata = { scrollable: false };
                const output = new vscode.NotebookCellOutput([stdoutItem], { scrollable: false });
                exec.replaceOutput([output]);
                // TODO: Properly update via NotebookCellOutputItem.error later.
            }

            exec.end(result?.status);
        }
    };
    disposables.push(controller);
    return controller;
}
