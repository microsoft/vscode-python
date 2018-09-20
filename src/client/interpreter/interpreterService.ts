import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ConfigurationTarget, Disposable, Event, EventEmitter, Uri } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../common/application/types';
import { PythonSettings } from '../common/configSettings';
import { getArchitectureDisplayName } from '../common/platform/registry';
import { IFileSystem } from '../common/platform/types';
import { IPythonExecutionFactory } from '../common/process/types';
import { IConfigurationService, IDisposableRegistry, IPersistentStateFactory } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { IPythonPathUpdaterServiceManager } from './configuration/types';
import {
    IInterpreterDisplay, IInterpreterHelper, IInterpreterLocatorService,
    IInterpreterService, INTERPRETER_LOCATOR_SERVICE,
    InterpreterType, PIPENV_SERVICE, PythonInterpreter, WORKSPACE_VIRTUAL_ENV_SERVICE
} from './contracts';
import { IVirtualEnvironmentManager } from './virtualEnvs/types';

const EXPITY_DURATION = 24 * 60 * 60 * 1000;

@injectable()
export class InterpreterService implements Disposable, IInterpreterService {
    private readonly locator: IInterpreterLocatorService;
    private readonly pythonPathUpdaterService: IPythonPathUpdaterServiceManager;
    private readonly fs: IFileSystem;
    private readonly persistentStateFactory: IPersistentStateFactory;
    private readonly helper: IInterpreterHelper;
    private readonly didChangeInterpreterEmitter = new EventEmitter<void>();

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.locator = serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE);
        this.helper = serviceContainer.get<IInterpreterHelper>(IInterpreterHelper);
        this.pythonPathUpdaterService = this.serviceContainer.get<IPythonPathUpdaterServiceManager>(IPythonPathUpdaterServiceManager);
        this.fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        this.persistentStateFactory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
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

    public async getInterpreters(resource?: Uri): Promise<PythonInterpreter[]> {
        const interpreters = await this.locator.getInterpreters(resource);
        await Promise.all(interpreters
            .filter(item => !item.displayName)
            .map(async item => item.displayName = await this.getDisplayName(item, resource)));
        return interpreters;
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

        const interpretersInWorkspace = interpreters.filter(interpreter => Uri.file(interpreter.path).fsPath.toUpperCase().startsWith(workspacePathUpper));
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
        // If we don't have the fully qualified path, then get it.
        if (path.basename(pythonPath) === pythonPath) {
            const pythonExecutionFactory = this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
            const pythonExecutionService = await pythonExecutionFactory.create({ resource });
            pythonPath = await pythonExecutionService.getExecutablePath().catch(() => '');
            // Python path is invalid or python isn't installed.
            if (!pythonPath) {
                return;
            }
        }

        let fileHash = await this.fs.getFileHash(pythonPath).catch(() => '');
        fileHash = fileHash ? fileHash : '';
        const store = this.persistentStateFactory.createGlobalPersistentState<PythonInterpreter & { fileHash: string }>(`${pythonPath}.interpreter.details.v2`, undefined, EXPITY_DURATION);
        if (store.value && fileHash && store.value.fileHash === fileHash) {
            return store.value;
        }

        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        const interpreters = await this.getInterpreters(resource);
        let interpreterInfo = interpreters.find(i => fs.arePathsSame(i.path, pythonPath));
        if (!interpreterInfo) {
            const interpreterHelper = this.serviceContainer.get<IInterpreterHelper>(IInterpreterHelper);
            const virtualEnvManager = this.serviceContainer.get<IVirtualEnvironmentManager>(IVirtualEnvironmentManager);
            const [info, type] = await Promise.all([
                interpreterHelper.getInterpreterInformation(pythonPath),
                virtualEnvManager.getEnvironmentType(pythonPath)
            ]);
            if (!info) {
                return;
            }
            const details: Partial<PythonInterpreter> = {
                ...(info as PythonInterpreter),
                path: pythonPath,
                type: type
            };

            const virtualEnvName = await virtualEnvManager.getEnvironmentName(pythonPath, resource);
            interpreterInfo = {
                ...(details as PythonInterpreter),
                envName: virtualEnvName
            };
            interpreterInfo.displayName = await this.getDisplayName(interpreterInfo, resource);
        }

        await store.updateValue({ ...interpreterInfo, path: pythonPath, fileHash });
        return interpreterInfo;
    }

    /**
     * Gets the display name of an interpreter.
     * The format is `Python <Version> <bitness> (<env name>: <env type>)`
     * E.g. `Python 3.5.1 32-bit (myenv2: virtualenv)`
     * @param {Partial<PythonInterpreter>} info
     * @returns {string}
     * @memberof InterpreterService
     */
    public async getDisplayName(info: Partial<PythonInterpreter>, resource?: Uri): Promise<string> {
        const store = this.persistentStateFactory.createGlobalPersistentState<string>(`${info.path}.interpreter.displayName.v3`, undefined, EXPITY_DURATION);
        if (store.value) {
            return store.value;
        }

        const displayNameParts: string[] = ['Python'];
        const envSuffixParts: string[] = [];

        if (info.version_info && info.version_info.length > 0) {
            displayNameParts.push(info.version_info.slice(0, 3).join('.'));
        }
        if (info.architecture) {
            displayNameParts.push(getArchitectureDisplayName(info.architecture));
        }
        if (!info.envName && info.path && info.type && info.type === InterpreterType.PipEnv) {
            // If we do not have the name of the environment, then try to get it again.
            // This can happen based on the context (i.e. resource).
            // I.e. we can determine if an environment is PipEnv only when giving it the right workspacec path (i.e. resource).
            const virtualEnvMgr = this.serviceContainer.get<IVirtualEnvironmentManager>(IVirtualEnvironmentManager);
            info.envName = await virtualEnvMgr.getEnvironmentName(info.path, resource);
        }
        if (info.envName && info.envName.length > 0) {
            envSuffixParts.push(`'${info.envName}'`);
        }
        if (info.type) {
            const interpreterHelper = this.serviceContainer.get<IInterpreterHelper>(IInterpreterHelper);
            const name = interpreterHelper.getInterpreterTypeDisplayName(info.type);
            if (name) {
                envSuffixParts.push(name);
            }
        }

        const envSuffix = envSuffixParts.length === 0 ? '' :
            `(${envSuffixParts.join(': ')})`;
        const displayName = `${displayNameParts.join(' ')} ${envSuffix}`.trim();

        // If dealing with cached entry, then do not store the display name in cache.
        if (!info.cachedEntry) {
            await store.updateValue(displayName);
        }

        return displayName;
    }
    public async shouldAutoSetInterpreter(): Promise<boolean> {
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
