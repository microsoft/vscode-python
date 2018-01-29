import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ConfigurationTarget, Disposable, StatusBarAlignment, Uri, window, workspace } from 'vscode';
import { PythonSettings } from '../common/configSettings';
import { IPythonExecutionFactory } from '../common/process/types';
import { IDisposableRegistry } from '../common/types';
import * as utils from '../common/utils';
import { IServiceContainer } from '../ioc/types';
import { PythonPathUpdaterService } from './configuration/pythonPathUpdaterService';
import { PythonPathUpdaterServiceFactory } from './configuration/pythonPathUpdaterServiceFactory';
import { IInterpreterLocatorService, IInterpreterService, IInterpreterVersionService, INTERPRETER_LOCATOR_SERVICE, InterpreterType, PythonInterpreter } from './contracts';
import { InterpreterDisplay } from './display';
import { getActiveWorkspaceUri } from './helpers';
import { PythonInterpreterLocatorService } from './locators';
import { VirtualEnvService } from './locators/services/virtualEnvService';
import { IVirtualEnvironmentManager } from './virtualEnvs/types';

@injectable()
export class InterpreterManager implements Disposable, IInterpreterService {
    private display: InterpreterDisplay | null | undefined;
    private interpreterProvider: PythonInterpreterLocatorService;
    private pythonPathUpdaterService: PythonPathUpdaterService;
    constructor( @inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        const virtualEnvMgr = serviceContainer.get<IVirtualEnvironmentManager>(IVirtualEnvironmentManager);
        const statusBar = window.createStatusBarItem(StatusBarAlignment.Left);
        this.interpreterProvider = serviceContainer.get<PythonInterpreterLocatorService>(IInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE);
        const versionService = serviceContainer.get<IInterpreterVersionService>(IInterpreterVersionService);
        this.display = new InterpreterDisplay(statusBar, this, virtualEnvMgr, versionService);
        this.pythonPathUpdaterService = new PythonPathUpdaterService(new PythonPathUpdaterServiceFactory(), versionService);
        PythonSettings.getInstance().addListener('change', () => this.onConfigChanged());

        const disposables = this.serviceContainer.get<Disposable[]>(IDisposableRegistry);
        disposables.push(window.onDidChangeActiveTextEditor(() => this.refresh()));
        disposables.push(statusBar);
        disposables.push(this.display!);
    }
    public async refresh() {
        return this.display!.refresh();
    }
    public getInterpreters(resource?: Uri) {
        return this.interpreterProvider.getInterpreters(resource);
    }
    public async autoSetInterpreter() {
        if (!this.shouldAutoSetInterpreter()) {
            return;
        }
        const activeWorkspace = getActiveWorkspaceUri();
        if (!activeWorkspace) {
            return;
        }
        const virtualEnvMgr = this.serviceContainer.get<IVirtualEnvironmentManager>(IVirtualEnvironmentManager);
        const versionService = this.serviceContainer.get<IInterpreterVersionService>(IInterpreterVersionService);
        const virtualEnvInterpreterProvider = new VirtualEnvService([activeWorkspace.folderUri.fsPath], virtualEnvMgr, versionService);
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
        this.display = null;
        this.interpreterProvider.dispose();
    }

    public async getActiveInterpreter(resource?: Uri): Promise<PythonInterpreter> {
        const pythonExecutionFactory = this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        const pythonExecutionService = await pythonExecutionFactory.create(resource);
        const fullyQualifiedPath = await pythonExecutionService.getExecutablePath();
        const interpreters = await this.getInterpreters(resource);
        const interpreter = interpreters.find(i => utils.arePathsSame(i.path, fullyQualifiedPath));

        if (interpreter) {
            return interpreter;
        }
        const pythonExecutableName = path.basename(fullyQualifiedPath);
        const versionInfo = await this.serviceContainer.get<IInterpreterVersionService>(IInterpreterVersionService).getVersion(fullyQualifiedPath, pythonExecutableName);
        return {
            path: fullyQualifiedPath,
            type: InterpreterType.Unknown,
            version: versionInfo
        };
    }
    private shouldAutoSetInterpreter() {
        const activeWorkspace = getActiveWorkspaceUri();
        if (!activeWorkspace) {
            return false;
        }
        const pythonConfig = workspace.getConfiguration('python', activeWorkspace.folderUri);
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
    private onConfigChanged() {
        if (this.display) {
            this.display!.refresh()
                .catch(ex => console.error('Python Extension: display.refresh', ex));
        }
    }
}
