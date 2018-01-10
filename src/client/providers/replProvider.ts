import { commands, Disposable, Uri, window } from 'vscode';
import { Commands } from '../common/constants';
import { IPythonExecutionFactory } from '../common/process/types';
import { captureTelemetry } from '../telemetry';
import { REPL } from '../telemetry/constants';

export class ReplProvider implements Disposable {
    private readonly disposables: Disposable[] = [];
    constructor(private pythonExecutionFactory: IPythonExecutionFactory) {
        this.registerCommand();
    }
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    private registerCommand() {
        const disposable = commands.registerCommand(Commands.Start_REPL, this.commandHandler, this);
        this.disposables.push(disposable);
    }
    @captureTelemetry(REPL)
    private async commandHandler() {
        // If we have any active window open, then use that as the uri
        const resource: Uri | undefined = window.activeTextEditor ? window.activeTextEditor!.document.uri : undefined;
        const executionFactory = await this.pythonExecutionFactory.create(resource);
        const pythonInterpreterPath = await executionFactory.getExecutablePath().catch(() => 'python');
        const term = window.createTerminal('Python', pythonInterpreterPath);
        term.show();
        this.disposables.push(term);
    }
}
