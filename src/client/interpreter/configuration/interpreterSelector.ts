import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ConfigurationTarget, Disposable, QuickPickItem, QuickPickOptions, Uri } from 'vscode';
import { IApplicationShell, ICommandManager, IDocumentManager, IWorkspaceService } from '../../common/application/types';
import * as settings from '../../common/configSettings';
import { Commands } from '../../common/constants';
import { IServiceContainer } from '../../ioc/types';
import { IInterpreterService, IShebangCodeLensProvider, PythonInterpreter, WorkspacePythonPath } from '../contracts';
import { IInterpreterSelector, IPythonPathUpdaterServiceManager } from './types';

export interface IInterpreterQuickPickItem extends QuickPickItem {
    path: string;
}

@injectable()
export class InterpreterSelector implements IInterpreterSelector {
    private disposables: Disposable[] = [];
    private readonly interpreterManager: IInterpreterService;
    private readonly workspaceService: IWorkspaceService;
    private readonly applicationShell: IApplicationShell;
    private readonly documentManager: IDocumentManager;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.interpreterManager = serviceContainer.get<IInterpreterService>(IInterpreterService);
        this.workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.applicationShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.documentManager = this.serviceContainer.get<IDocumentManager>(IDocumentManager);

        const commandManager = serviceContainer.get<ICommandManager>(ICommandManager);
        this.disposables.push(commandManager.registerCommand(Commands.Set_Interpreter, this.setInterpreter.bind(this)));
        this.disposables.push(commandManager.registerCommand(Commands.Set_ShebangInterpreter, this.setShebangInterpreter.bind(this)));
    }
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }

    public async getSuggestions(resourceUri?: Uri) {
        const interpreters = await this.interpreterManager.getInterpreters(resourceUri);
        // tslint:disable-next-line:no-non-null-assertion
        interpreters.sort((a, b) => a.displayName! > b.displayName! ? 1 : -1);
        return Promise.all(interpreters.map(item => this.suggestionToQuickPickItem(item, resourceUri)));
    }

    private async getWorkspaceToSetPythonPath(): Promise<WorkspacePythonPath | undefined> {
        if (!Array.isArray(this.workspaceService.workspaceFolders) || this.workspaceService.workspaceFolders.length === 0) {
            return undefined;
        }
        if (this.workspaceService.workspaceFolders.length === 1) {
            return { folderUri: this.workspaceService.workspaceFolders[0].uri, configTarget: ConfigurationTarget.Workspace };
        }

        // Ok we have multiple interpreters, get the user to pick a folder.
        const applicationShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        const workspaceFolder = await applicationShell.showWorkspaceFolderPick({ placeHolder: 'Select a workspace' });
        return workspaceFolder ? { folderUri: workspaceFolder.uri, configTarget: ConfigurationTarget.WorkspaceFolder } : undefined;
    }

    private async suggestionToQuickPickItem(suggestion: PythonInterpreter, workspaceUri?: Uri): Promise<IInterpreterQuickPickItem> {
        let detail = suggestion.path;
        if (workspaceUri && suggestion.path.startsWith(workspaceUri.fsPath)) {
            detail = `.${path.sep}${path.relative(workspaceUri.fsPath, suggestion.path)}`;
        }
        const cachedPrefix = suggestion.cachedEntry ? '(cached) ' : '';
        return {
            // tslint:disable-next-line:no-non-null-assertion
            label: suggestion.displayName!,
            description: suggestion.companyDisplayName || '',
            detail: `${cachedPrefix}${detail}`,
            path: suggestion.path
        };
    }

    private async setInterpreter() {
        const setInterpreterGlobally = !Array.isArray(this.workspaceService.workspaceFolders) || this.workspaceService.workspaceFolders.length === 0;
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

        const selection = await this.applicationShell.showQuickPick(suggestions, quickPickOptions);
        if (selection !== undefined) {
            const pythonPathUpdaterService = this.serviceContainer.get<IPythonPathUpdaterServiceManager>(IPythonPathUpdaterServiceManager);
            await pythonPathUpdaterService.updatePythonPath(selection.path, configTarget, 'ui', wkspace);
        }
    }

    private async setShebangInterpreter(): Promise<void> {
        const shebangCodeLensProvider = this.serviceContainer.get<IShebangCodeLensProvider>(IShebangCodeLensProvider);
        const shebang = await shebangCodeLensProvider.detectShebang(this.documentManager.activeTextEditor!.document);
        if (!shebang) {
            return;
        }

        const isGlobalChange = !Array.isArray(this.workspaceService.workspaceFolders) || this.workspaceService.workspaceFolders.length === 0;
        const workspaceFolder = this.workspaceService.getWorkspaceFolder(this.documentManager.activeTextEditor!.document.uri);
        const isWorkspaceChange = Array.isArray(this.workspaceService.workspaceFolders) && this.workspaceService.workspaceFolders.length === 1;

        const pythonPathUpdaterService = this.serviceContainer.get<IPythonPathUpdaterServiceManager>(IPythonPathUpdaterServiceManager);
        if (isGlobalChange) {
            await pythonPathUpdaterService.updatePythonPath(shebang, ConfigurationTarget.Global, 'shebang');
            return;
        }

        if (isWorkspaceChange || !workspaceFolder) {
            await pythonPathUpdaterService.updatePythonPath(shebang, ConfigurationTarget.Workspace, 'shebang', this.workspaceService.workspaceFolders![0].uri);
            return;
        }

        await pythonPathUpdaterService.updatePythonPath(shebang, ConfigurationTarget.WorkspaceFolder, 'shebang', workspaceFolder.uri);
    }
}
