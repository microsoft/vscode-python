import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ConfigurationTarget, Disposable, QuickPickItem, QuickPickOptions, Uri } from 'vscode';
import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    IWorkspaceService
} from '../../common/application/types';
import { Commands } from '../../common/constants';
import { DeprecatePythonPath } from '../../common/experimentGroups';
import { IConfigurationService, IExperimentsManager, IPathUtils, Resource } from '../../common/types';
import { Interpreters } from '../../common/utils/localize';
import { IInterpreterSecurityService } from '../autoSelection/types';
import { IInterpreterService, IShebangCodeLensProvider, PythonInterpreter } from '../contracts';
import {
    IInterpreterComparer,
    IInterpreterQuickPickItem,
    IInterpreterSelector,
    IPythonPathUpdaterServiceManager
} from './types';

@injectable()
export class InterpreterSelector implements IInterpreterSelector {
    private disposables: Disposable[] = [];

    constructor(
        @inject(IInterpreterService) private readonly interpreterManager: IInterpreterService,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils,
        @inject(IInterpreterComparer) private readonly interpreterComparer: IInterpreterComparer,
        @inject(IPythonPathUpdaterServiceManager)
        private readonly pythonPathUpdaterService: IPythonPathUpdaterServiceManager,
        @inject(IShebangCodeLensProvider) private readonly shebangCodeLensProvider: IShebangCodeLensProvider,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IExperimentsManager) private readonly experimentsManager: IExperimentsManager,
        @inject(IInterpreterSecurityService) private readonly interpreterSecurityService: IInterpreterSecurityService
    ) {}
    public dispose() {
        this.disposables.forEach((disposable) => disposable.dispose());
    }

    public initialize() {
        this.disposables.push(
            this.commandManager.registerCommand(Commands.Set_Interpreter, this.setInterpreter.bind(this))
        );
        this.disposables.push(
            this.commandManager.registerCommand(Commands.ClearWorkspaceInterpreter, this.resetInterpreter.bind(this))
        );
        this.disposables.push(
            this.commandManager.registerCommand(Commands.Set_ShebangInterpreter, this.setShebangInterpreter.bind(this))
        );
    }

    public async getSuggestions(resource: Resource) {
        let interpreters = await this.interpreterManager.getInterpreters(resource);
        if (this.experimentsManager.inExperiment(DeprecatePythonPath.experiment)) {
            interpreters = interpreters.filter((item) => this.interpreterSecurityService.isSafe(item) !== false);
        }
        this.experimentsManager.sendTelemetryIfInExperiment(DeprecatePythonPath.control);
        interpreters.sort(this.interpreterComparer.compare.bind(this.interpreterComparer));
        return Promise.all(interpreters.map((item) => this.suggestionToQuickPickItem(item, resource)));
    }

    protected async resetInterpreter() {
        const targetConfig = await this.getConfigTarget();
        if (!targetConfig) {
            return;
        }
        const configTarget = targetConfig.configTarget;
        const wkspace = targetConfig.folderUri;

        await this.pythonPathUpdaterService.updatePythonPath(undefined, configTarget, 'ui', wkspace);
    }
    protected async suggestionToQuickPickItem(
        suggestion: PythonInterpreter,
        workspaceUri?: Uri
    ): Promise<IInterpreterQuickPickItem> {
        const detail = this.pathUtils.getDisplayName(suggestion.path, workspaceUri ? workspaceUri.fsPath : undefined);
        const cachedPrefix = suggestion.cachedEntry ? '(cached) ' : '';
        return {
            // tslint:disable-next-line:no-non-null-assertion
            label: suggestion.displayName!,
            detail: `${cachedPrefix}${detail}`,
            path: suggestion.path,
            interpreter: suggestion
        };
    }

    protected async setInterpreter() {
        const targetConfig = await this.getConfigTarget();
        if (!targetConfig) {
            return;
        }
        const configTarget = targetConfig.configTarget;
        const wkspace = targetConfig.folderUri;

        const suggestions = await this.getSuggestions(wkspace);
        const currentPythonPath = this.pathUtils.getDisplayName(
            this.configurationService.getSettings(wkspace).pythonPath,
            wkspace ? wkspace.fsPath : undefined
        );
        const quickPickOptions: QuickPickOptions = {
            matchOnDetail: true,
            matchOnDescription: true,
            placeHolder: `current: ${currentPythonPath}`
        };

        const selection = await this.applicationShell.showQuickPick(suggestions, quickPickOptions);
        if (selection !== undefined) {
            await this.pythonPathUpdaterService.updatePythonPath(selection.path, configTarget, 'ui', wkspace);
        }
    }

    protected async setShebangInterpreter(): Promise<void> {
        const shebang = await this.shebangCodeLensProvider.detectShebang(
            this.documentManager.activeTextEditor!.document
        );
        if (!shebang) {
            return;
        }

        const isGlobalChange =
            !Array.isArray(this.workspaceService.workspaceFolders) ||
            this.workspaceService.workspaceFolders.length === 0;
        const workspaceFolder = this.workspaceService.getWorkspaceFolder(
            this.documentManager.activeTextEditor!.document.uri
        );
        const isWorkspaceChange =
            Array.isArray(this.workspaceService.workspaceFolders) &&
            this.workspaceService.workspaceFolders.length === 1;

        if (isGlobalChange) {
            await this.pythonPathUpdaterService.updatePythonPath(shebang, ConfigurationTarget.Global, 'shebang');
            return;
        }

        if (isWorkspaceChange || !workspaceFolder) {
            await this.pythonPathUpdaterService.updatePythonPath(
                shebang,
                ConfigurationTarget.Workspace,
                'shebang',
                this.workspaceService.workspaceFolders![0].uri
            );
            return;
        }

        await this.pythonPathUpdaterService.updatePythonPath(
            shebang,
            ConfigurationTarget.WorkspaceFolder,
            'shebang',
            workspaceFolder.uri
        );
    }
    private async getConfigTarget(): Promise<
        | {
              folderUri: Resource;
              configTarget: ConfigurationTarget;
          }
        | undefined
    > {
        if (
            !Array.isArray(this.workspaceService.workspaceFolders) ||
            this.workspaceService.workspaceFolders.length === 0
        ) {
            return {
                folderUri: undefined,
                configTarget: ConfigurationTarget.Global
            };
        }
        if (!this.workspaceService.workspaceFile && this.workspaceService.workspaceFolders.length === 1) {
            return {
                folderUri: this.workspaceService.workspaceFolders[0].uri,
                configTarget: ConfigurationTarget.WorkspaceFolder
            };
        }

        // Ok we have multiple workspaces, get the user to pick a folder.

        type WorkspaceSelectionQuickPickItem = QuickPickItem & { uri: Uri };
        const quickPickItems: WorkspaceSelectionQuickPickItem[] = [
            ...this.workspaceService.workspaceFolders.map((w) => ({
                label: w.name,
                description: path.dirname(w.uri.fsPath),
                uri: w.uri
            })),
            {
                label: Interpreters.entireWorkspace(),
                uri: this.workspaceService.workspaceFolders[0].uri
            }
        ];

        const selection = await this.applicationShell.showQuickPick(quickPickItems, {
            placeHolder: 'Select the workspace to set the interpreter'
        });

        return selection
            ? selection.label === Interpreters.entireWorkspace()
                ? { folderUri: selection.uri, configTarget: ConfigurationTarget.Workspace }
                : { folderUri: selection.uri, configTarget: ConfigurationTarget.WorkspaceFolder }
            : undefined;
    }
}
