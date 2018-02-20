import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ConfigurationTarget, Disposable, Event, EventEmitter, Uri } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../common/application/types';
import { PythonSettings } from '../common/configSettings';
import { IPythonExecutionFactory } from '../common/process/types';
import { IConfigurationService, IDisposableRegistry } from '../common/types';
import * as utils from '../common/utils';
import { IServiceContainer } from '../ioc/types';
import { IPythonPathUpdaterServiceManager } from './configuration/types';
import {
    IInterpreterDisplay, IInterpreterHelper, IInterpreterLocatorService,
    IInterpreterService, IInterpreterVersionService, INTERPRETER_LOCATOR_SERVICE,
    InterpreterType, PythonInterpreter, WORKSPACE_VIRTUAL_ENV_SERVICE
} from './contracts';
import { IVirtualEnvironmentManager } from './virtualEnvs/types';

@injectable()
export class InterpreterManager implements Disposable, IInterpreterService {
    private readonly interpreterProvider: IInterpreterLocatorService;
    private readonly pythonPathUpdaterService: IPythonPathUpdaterServiceManager;
    private readonly helper: IInterpreterHelper;
    private readonly didChangeInterpreterEmitter = new EventEmitter<void>();

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.interpreterProvider = serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE);
        this.helper = serviceContainer.get<IInterpreterHelper>(IInterpreterHelper);

        this.pythonPathUpdaterService = this.serviceContainer.get<IPythonPathUpdaterServiceManager>(IPythonPathUpdaterServiceManager);
    }

    public async refresh(resource?: Uri) {
        const interpreterDisplay = this.serviceContainer.get<IInterpreterDisplay>(IInterpreterDisplay);
        return interpreterDisplay.refresh(resource);
    }

    public initialize() {
        const disposables = this.serviceContainer.get<Disposable[]>(IDisposableRegistry);
        const documentManager = this.serviceContainer.get<IDocumentManager>(IDocumentManager);
        disposables.push(documentManager.onDidChangeActiveTextEditor((e) => this.refresh(e.document.uri)));
        const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        (configService.getSettings() as PythonSettings).addListener('change', this.onConfigChanged);
    }

    public getInterpreters(resource?: Uri) {
        return this.interpreterProvider.getInterpreters(resource);
    }

    public async autoSetInterpreter() {
        if (!this.shouldAutoSetInterpreter()) {
            return;
        }
        const activeWorkspace = this.helper.getActiveWorkspaceUri();
        if (!activeWorkspace) {
            return;
        }
        const virtualEnvInterpreterProvider = this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, WORKSPACE_VIRTUAL_ENV_SERVICE);
        const interpreters = await virtualEnvInterpreterProvider.getInterpreters(activeWorkspace.folderUri);
        const workspacePathUpper = activeWorkspace.folderUri.fsPath.toUpperCase();

        const interpretersInWorkspace = interpreters.filter(interpreter => interpreter.path.toUpperCase().startsWith(workspacePathUpper));
        if (interpretersInWorkspace.length === 0) {
            return;
        }

        // Always pick the highest version by default.
        // Ensure this new environment is at the same level as the current workspace.
        // In windows the interpreter is under scripts/python.exe on linux it is under bin/python.
        // Meaning the sub directory must be either scripts, bin or other (but only one level deep).
        const pythonPath = interpretersInWorkspace.sort((a, b) => a.version! > b.version! ? 1 : -1)[0].path;
        const relativePath = path.dirname(pythonPath).substring(activeWorkspace.folderUri.fsPath.length);
        if (relativePath.split(path.sep).filter(l => l.length > 0).length === 2) {
            await this.pythonPathUpdaterService.updatePythonPath(pythonPath, activeWorkspace.configTarget, 'load', activeWorkspace.folderUri);
        }
    }

    public dispose(): void {
        this.interpreterProvider.dispose();
        const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        (configService.getSettings() as PythonSettings).removeListener('change', this.onConfigChanged);
        this.didChangeInterpreterEmitter.dispose();
    }

    public get onDidChangeInterpreter(): Event<void> {
        return this.didChangeInterpreterEmitter.event;
    }

    public async getActiveInterpreter(resource?: Uri): Promise<PythonInterpreter | undefined> {
        const pythonExecutionFactory = this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        const pythonExecutionService = await pythonExecutionFactory.create(resource);
        const fullyQualifiedPath = await pythonExecutionService.getExecutablePath().catch(() => undefined);
        // Python path is invalid or python isn't installed.
        if (!fullyQualifiedPath) {
            return;
        }
        const interpreters = await this.getInterpreters(resource);
        const interpreter = interpreters.find(i => utils.arePathsSame(i.path, fullyQualifiedPath));

        if (interpreter) {
            return interpreter;
        }
        const pythonExecutableName = path.basename(fullyQualifiedPath);
        const versionInfo = await this.serviceContainer.get<IInterpreterVersionService>(IInterpreterVersionService).getVersion(fullyQualifiedPath, pythonExecutableName);
        const virtualEnvManager = this.serviceContainer.get<IVirtualEnvironmentManager>(IVirtualEnvironmentManager);
        const virtualEnvName = await virtualEnvManager.getEnvironmentName(fullyQualifiedPath);
        const dislayNameSuffix = virtualEnvName.length > 0 ? ` (${virtualEnvName})` : '';
        const displayName = `${versionInfo}${dislayNameSuffix}`;
        return {
            displayName,
            path: fullyQualifiedPath,
            type: virtualEnvName.length > 0 ? InterpreterType.VirtualEnv : InterpreterType.Unknown,
            version: versionInfo
        };
    }
    private shouldAutoSetInterpreter() {
        const activeWorkspace = this.helper.getActiveWorkspaceUri();
        if (!activeWorkspace) {
            return false;
        }
        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        const pythonConfig = workspaceService.getConfiguration('python', activeWorkspace.folderUri);
        const pythonPathInConfig = pythonConfig.inspect<string>('pythonPath');
        // If we have a value in user settings, then don't auto set the interpreter path.
        if (pythonPathInConfig && pythonPathInConfig!.globalValue !== undefined && pythonPathInConfig!.globalValue !== 'python') {
            return false;
        }
        if (activeWorkspace.configTarget === ConfigurationTarget.Workspace) {
            return pythonPathInConfig!.workspaceValue === undefined || pythonPathInConfig!.workspaceValue === 'python';
        }
        if (activeWorkspace.configTarget === ConfigurationTarget.WorkspaceFolder) {
            return pythonPathInConfig!.workspaceFolderValue === undefined || pythonPathInConfig!.workspaceFolderValue === 'python';
        }
        return false;
    }
    private onConfigChanged = () => {
        this.didChangeInterpreterEmitter.fire();
        const interpreterDisplay = this.serviceContainer.get<IInterpreterDisplay>(IInterpreterDisplay);
        interpreterDisplay.refresh()
            .catch(ex => console.error('Python Extension: display.refresh', ex));
    }
}
