import * as path from 'path';
import { commands, ConfigurationTarget, Disposable, QuickPickItem, QuickPickOptions, Uri, window, workspace } from 'vscode';
import { InterpreterManager } from '../';
import * as settings from '../../common/configSettings';
import { IProcessService } from '../../common/process/types';
import { IInterpreterVersionService, PythonInterpreter, WorkspacePythonPath } from '../contracts';
import { ShebangCodeLensProvider } from '../display/shebangCodeLensProvider';
import { PythonPathUpdaterService } from './pythonPathUpdaterService';
import { PythonPathUpdaterServiceFactory } from './pythonPathUpdaterServiceFactory';

// tslint:disable-next-line:interface-name
interface PythonPathQuickPickItem extends QuickPickItem {
    path: string;
}

export class SetInterpreterProvider implements Disposable {
    private disposables: Disposable[] = [];
    private pythonPathUpdaterService: PythonPathUpdaterService;
    constructor(private interpreterManager: InterpreterManager,
        interpreterVersionService: IInterpreterVersionService,
        private processService: IProcessService) {
        this.disposables.push(commands.registerCommand('python.setInterpreter', this.setInterpreter.bind(this)));
        this.disposables.push(commands.registerCommand('python.setShebangInterpreter', this.setShebangInterpreter.bind(this)));
        this.pythonPathUpdaterService = new PythonPathUpdaterService(new PythonPathUpdaterServiceFactory(), interpreterVersionService);
    }
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    private async getWorkspaceToSetPythonPath(): Promise<WorkspacePythonPath | undefined> {
        if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
            return undefined;
        }
        if (workspace.workspaceFolders.length === 1) {
            return { folderUri: workspace.workspaceFolders[0].uri, configTarget: ConfigurationTarget.Workspace };
        }

        // Ok we have multiple interpreters, get the user to pick a folder.
        // tslint:disable-next-line:no-any prefer-type-cast
        const workspaceFolder = await (window as any).showWorkspaceFolderPick({ placeHolder: 'Select a workspace' });
        return workspaceFolder ? { folderUri: workspaceFolder.uri, configTarget: ConfigurationTarget.WorkspaceFolder } : undefined;
    }
    private async suggestionToQuickPickItem(suggestion: PythonInterpreter, workspaceUri?: Uri): Promise<PythonPathQuickPickItem> {
        let detail = suggestion.path;
        if (workspaceUri && suggestion.path.startsWith(workspaceUri.fsPath)) {
            detail = `.${path.sep}${path.relative(workspaceUri.fsPath, suggestion.path)}`;
        }
        return {
            // tslint:disable-next-line:no-non-null-assertion
            label: suggestion.displayName!,
            description: suggestion.companyDisplayName || '',
            detail: detail,
            path: suggestion.path
        };
    }

    private async getSuggestions(resourceUri?: Uri) {
        const interpreters = await this.interpreterManager.getInterpreters(resourceUri);
        // tslint:disable-next-line:no-non-null-assertion
        interpreters.sort((a, b) => a.displayName! > b.displayName! ? 1 : -1);
        return Promise.all(interpreters.map(item => this.suggestionToQuickPickItem(item, resourceUri)));
    }

    private async setInterpreter() {
        const setInterpreterGlobally = !Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0;
        let configTarget = ConfigurationTarget.Global;
        let wkspace: Uri | undefined;
        if (!setInterpreterGlobally) {
            const targetConfig = await this.getWorkspaceToSetPythonPath();
            if (!targetConfig) {
                return;
            }
            configTarget = targetConfig.configTarget;
            wkspace = targetConfig.folderUri;
        }

        const suggestions = await this.getSuggestions(wkspace);
        let currentPythonPath = settings.PythonSettings.getInstance().pythonPath;
        if (wkspace && currentPythonPath.startsWith(wkspace.fsPath)) {
            currentPythonPath = `.${path.sep}${path.relative(wkspace.fsPath, currentPythonPath)}`;
        }
        const quickPickOptions: QuickPickOptions = {
            matchOnDetail: true,
            matchOnDescription: true,
            placeHolder: `current: ${currentPythonPath}`
        };

        const selection = await window.showQuickPick(suggestions, quickPickOptions);
        if (selection !== undefined) {
            await this.pythonPathUpdaterService.updatePythonPath(selection.path, configTarget, 'ui', wkspace);
        }
    }

    private async setShebangInterpreter(): Promise<void> {
        const shebang = await new ShebangCodeLensProvider(this.processService).detectShebang(window.activeTextEditor!.document);
        if (!shebang) {
            return;
        }

        const isGlobalChange = !Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0;
        const workspaceFolder = workspace.getWorkspaceFolder(window.activeTextEditor!.document.uri);
        const isWorkspaceChange = Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length === 1;

        if (isGlobalChange) {
            await this.pythonPathUpdaterService.updatePythonPath(shebang, ConfigurationTarget.Global, 'shebang');
            return;
        }

        if (isWorkspaceChange || !workspaceFolder) {
            await this.pythonPathUpdaterService.updatePythonPath(shebang, ConfigurationTarget.Workspace, 'shebang', workspace.workspaceFolders![0].uri);
            return;
        }

        await this.pythonPathUpdaterService.updatePythonPath(shebang, ConfigurationTarget.WorkspaceFolder, 'shebang', workspaceFolder.uri);
    }
}
