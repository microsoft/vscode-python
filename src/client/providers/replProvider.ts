import { commands, Disposable, window, workspace } from 'vscode';
import { PythonSettings } from '../common/configSettings';
import { Commands } from '../common/constants';
import { getPathFromPythonCommand } from '../common/utils';
import { captureTelemetry } from '../telemetry';
import { REPL } from '../telemetry/constants';

export class ReplProvider implements Disposable {
    private readonly disposables: Disposable[] = [];
    constructor() {
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
        const pythonPath = await this.getPythonPath();
        if (!pythonPath) {
            return;
        }
        let pythonInterpreterPath: string;
        try {
            pythonInterpreterPath = await getPathFromPythonCommand(pythonPath).catch(() => pythonPath);
            // tslint:disable-next-line:variable-name
        } catch (_ex) {
            pythonInterpreterPath = pythonPath;
        }
        const term = window.createTerminal('Python', pythonInterpreterPath);
        term.show();
        this.disposables.push(term);
    }
    private async getPythonPath(): Promise<string | undefined> {
        if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
            return PythonSettings.getInstance().pythonPath;
        }
        if (workspace.workspaceFolders.length === 1) {
            return PythonSettings.getInstance(workspace.workspaceFolders[0].uri).pythonPath;
        }

        // tslint:disable-next-line:no-any prefer-type-cast
        const workspaceFolder = await (window as any).showWorkspaceFolderPick({ placeHolder: 'Select a workspace' });
        return workspace ? PythonSettings.getInstance(workspaceFolder.uri).pythonPath : undefined;
    }
}
