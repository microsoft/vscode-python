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
    IInterpreterService, INTERPRETER_LOCATOR_SERVICE,
    PIPENV_SERVICE, PythonInterpreter, WORKSPACE_VIRTUAL_ENV_SERVICE
} from './contracts';
import { IVirtualEnvironmentManager } from './virtualEnvs/types';

@injectable()
export class InterpreterService implements Disposable, IInterpreterService {
    private readonly locator: IInterpreterLocatorService;
    private readonly pythonPathUpdaterService: IPythonPathUpdaterServiceManager;
    private readonly helper: IInterpreterHelper;
    private readonly didChangeInterpreterEmitter = new EventEmitter<void>();

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.locator = serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE);
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
        disposables.push(documentManager.onDidChangeActiveTextEditor((e) => e ? this.refresh(e.document.uri) : undefined));
        const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        (configService.getSettings() as PythonSettings).addListener('change', this.onConfigChanged);
    }

    public getInterpreters(resource?: Uri): Promise<PythonInterpreter[]> {
        return this.locator.getInterpreters(resource);
    }

    public async autoSetInterpreter(): Promise<void> {
        if (!await this.shouldAutoSetInterpreter()) {
            return;
        }
        const activeWorkspace = this.helper.getActiveWorkspaceUri();
        if (!activeWorkspace) {
            return;
        }
        // Check pipenv first.
        const pipenvService = this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, PIPENV_SERVICE);
        let interpreters = await pipenvService.getInterpreters(activeWorkspace.folderUri);
        if (interpreters.length > 0) {
            await this.pythonPathUpdaterService.updatePythonPath(interpreters[0].path, activeWorkspace.configTarget, 'load', activeWorkspace.folderUri);
            return;
        }
        // Now check virtual environments under the workspace root
        const virtualEnvInterpreterProvider = this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, WORKSPACE_VIRTUAL_ENV_SERVICE);
        interpreters = await virtualEnvInterpreterProvider.getInterpreters(activeWorkspace.folderUri);
        const workspacePathUpper = activeWorkspace.folderUri.fsPath.toUpperCase();

        const interpretersInWorkspace = interpreters.filter(interpreter => interpreter.path.toUpperCase().startsWith(workspacePathUpper));
        if (interpretersInWorkspace.length === 0) {
            return;
        }
        // Always pick the highest version by default.
        const pythonPath = interpretersInWorkspace.sort((a, b) => a.version! > b.version! ? 1 : -1)[0].path;
        // Ensure this new environment is at the same level as the current workspace.
        // In windows the interpreter is under scripts/python.exe on linux it is under bin/python.
        // Meaning the sub directory must be either scripts, bin or other (but only one level deep).
        const relativePath = path.dirname(pythonPath).substring(activeWorkspace.folderUri.fsPath.length);
        if (relativePath.split(path.sep).filter(l => l.length > 0).length === 2) {
            await this.pythonPathUpdaterService.updatePythonPath(pythonPath, activeWorkspace.configTarget, 'load', activeWorkspace.folderUri);
        }
    }

    public dispose(): void {
        this.locator.dispose();
        const configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        (configService.getSettings() as PythonSettings).removeListener('change', this.onConfigChanged);
        this.didChangeInterpreterEmitter.dispose();
    }

    public get onDidChangeInterpreter(): Event<void> {
        return this.didChangeInterpreterEmitter.event;
    }

    public async getActiveInterpreter(resource?: Uri): Promise<PythonInterpreter | undefined> {
        const pythonExecutionFactory = this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        const pythonExecutionService = await pythonExecutionFactory.create({ resource });
        const fullyQualifiedPath = await pythonExecutionService.getExecutablePath().catch(() => undefined);
        // Python path is invalid or python isn't installed.
        if (!fullyQualifiedPath) {
            return;
        }

        return this.getInterpreterDetails(fullyQualifiedPath, resource);
    }
    public async getInterpreterDetails(pythonPath: string, resource?: Uri): Promise<PythonInterpreter | undefined> {
        const interpreters = await this.getInterpreters(resource);
        const interpreter = interpreters.find(i => utils.arePathsSame(i.path, pythonPath));

        if (interpreter) {
            return interpreter;
        }
        const interpreterHelper = this.serviceContainer.get<IInterpreterHelper>(IInterpreterHelper);
        const virtualEnvManager = this.serviceContainer.get<IVirtualEnvironmentManager>(IVirtualEnvironmentManager);
        const [details, virtualEnvName, type] = await Promise.all([
            interpreterHelper.getInterpreterInformation(pythonPath),
            virtualEnvManager.getEnvironmentName(pythonPath),
            virtualEnvManager.getEnvironmentType(pythonPath)
        ]);
        if (!details) {
            return;
        }
        const dislayNameSuffix = virtualEnvName.length > 0 ? ` (${virtualEnvName})` : '';
        const displayName = `${details.version!}${dislayNameSuffix}`;
        return {
            ...(details as PythonInterpreter),
            displayName,
            path: pythonPath,
            envName: virtualEnvName,
            type: type
        };
    }
    private async shouldAutoSetInterpreter(): Promise<boolean> {
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
