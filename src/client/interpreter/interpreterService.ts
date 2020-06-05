import { inject, injectable } from 'inversify';
import * as md5 from 'md5';
import * as path from 'path';
import { Disposable, Event, EventEmitter, Uri } from 'vscode';
import '../../client/common/extensions';
import { IDocumentManager, IWorkspaceService } from '../common/application/types';
import { DeprecatePythonPath } from '../common/experiments/groups';
import { traceError } from '../common/logger';
import { getArchitectureDisplayName } from '../common/platform/registry';
import { IFileSystem } from '../common/platform/types';
import { IPythonExecutionFactory } from '../common/process/types';
import {
    IConfigurationService,
    IDisposableRegistry,
    IExperimentsManager,
    IInterpreterPathService,
    IPersistentState,
    IPersistentStateFactory,
    Resource
} from '../common/types';
import { sleep } from '../common/utils/async';
import { IServiceContainer } from '../ioc/types';
import { InterpreterType, PythonInterpreter } from '../pythonEnvironments/discovery/types';
import { captureTelemetry } from '../telemetry';
import { EventName } from '../telemetry/constants';
import {
    GetInterpreterOptions,
    IInterpreterDisplay,
    IInterpreterHelper,
    IInterpreterLocatorService,
    IInterpreterService,
    INTERPRETER_LOCATOR_SERVICE
} from './contracts';
import { InterpeterHashProviderFactory } from './locators/services/hashProviderFactory';
import { IInterpreterHashProviderFactory } from './locators/types';
import { IVirtualEnvironmentManager } from './virtualEnvs/types';

const EXPITY_DURATION = 24 * 60 * 60 * 1000;

@injectable()
export class InterpreterService implements Disposable, IInterpreterService {
    public get hasInterpreters(): Promise<boolean> {
        return this.locator.hasInterpreters;
    }

    public get onDidChangeInterpreter(): Event<void> {
        return this.didChangeInterpreterEmitter.event;
    }

    public get onDidChangeInterpreterInformation(): Event<PythonInterpreter> {
        return this.didChangeInterpreterInformation.event;
    }
    public _pythonPathSetting: string = '';
    private readonly locator: IInterpreterLocatorService;
    private readonly persistentStateFactory: IPersistentStateFactory;
    private readonly configService: IConfigurationService;
    private readonly interpreterPathService: IInterpreterPathService;
    private readonly experiments: IExperimentsManager;
    private readonly didChangeInterpreterEmitter = new EventEmitter<void>();
    private readonly didChangeInterpreterInformation = new EventEmitter<PythonInterpreter>();
    private readonly inMemoryCacheOfDisplayNames = new Map<string, string>();
    private readonly updatedInterpreters = new Set<string>();

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(InterpeterHashProviderFactory) private readonly hashProviderFactory: IInterpreterHashProviderFactory
    ) {
        this.locator = serviceContainer.get<IInterpreterLocatorService>(
            IInterpreterLocatorService,
            INTERPRETER_LOCATOR_SERVICE
        );
        this.persistentStateFactory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        this.configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.interpreterPathService = this.serviceContainer.get<IInterpreterPathService>(IInterpreterPathService);
        this.experiments = this.serviceContainer.get<IExperimentsManager>(IExperimentsManager);
    }

    public async refresh(resource?: Uri) {
        const interpreterDisplay = this.serviceContainer.get<IInterpreterDisplay>(IInterpreterDisplay);
        return interpreterDisplay.refresh(resource);
    }

    public initialize() {
        const disposables = this.serviceContainer.get<Disposable[]>(IDisposableRegistry);
        const documentManager = this.serviceContainer.get<IDocumentManager>(IDocumentManager);
        disposables.push(
            documentManager.onDidChangeActiveTextEditor((e) => (e ? this.refresh(e.document.uri) : undefined))
        );
        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        const pySettings = this.configService.getSettings();
        this._pythonPathSetting = pySettings.pythonPath;
        if (this.experiments.inExperiment(DeprecatePythonPath.experiment)) {
            disposables.push(
                this.interpreterPathService.onDidChange((i) => {
                    this._onConfigChanged(i.uri);
                })
            );
        } else {
            const workspacesUris: (Uri | undefined)[] = workspaceService.hasWorkspaceFolders
                ? workspaceService.workspaceFolders!.map((workspace) => workspace.uri)
                : [undefined];
            const disposable = workspaceService.onDidChangeConfiguration((e) => {
                const workspaceUriIndex = workspacesUris.findIndex((uri) =>
                    e.affectsConfiguration('python.pythonPath', uri)
                );
                const workspaceUri = workspaceUriIndex === -1 ? undefined : workspacesUris[workspaceUriIndex];
                this._onConfigChanged(workspaceUri);
            });
            disposables.push(disposable);
        }
        this.experiments.sendTelemetryIfInExperiment(DeprecatePythonPath.control);
    }

    @captureTelemetry(EventName.PYTHON_INTERPRETER_DISCOVERY, { locator: 'all' }, true)
    public async getInterpreters(resource?: Uri, options?: GetInterpreterOptions): Promise<PythonInterpreter[]> {
        const interpreters = await this.locator.getInterpreters(resource, options);
        await Promise.all(
            interpreters
                .filter((item) => !item.displayName)
                .map(async (item) => {
                    item.displayName = await this.getDisplayName(item, resource);
                    // Keep information up to date with latest details.
                    if (!item.cachedEntry) {
                        this.updateCachedInterpreterInformation(item, resource).ignoreErrors();
                    }
                })
        );
        return interpreters;
    }

    public dispose(): void {
        this.locator.dispose();
        this.didChangeInterpreterEmitter.dispose();
        this.didChangeInterpreterInformation.dispose();
    }

    public async getActiveInterpreter(resource?: Uri): Promise<PythonInterpreter | undefined> {
        // During shutdown we might not be able to get items out of the service container.
        const pythonExecutionFactory = this.serviceContainer.tryGet<IPythonExecutionFactory>(IPythonExecutionFactory);
        const pythonExecutionService = pythonExecutionFactory
            ? await pythonExecutionFactory.create({ resource })
            : undefined;
        const fullyQualifiedPath = pythonExecutionService
            ? await pythonExecutionService.getExecutablePath().catch(() => undefined)
            : undefined;
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

        const store = await this.getInterpreterCache(pythonPath);
        if (store.value && store.value.info) {
            return store.value.info;
        }

        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);

        // Don't want for all interpreters are collected.
        // Try to collect the infromation manually, that's faster.
        // Get from which ever comes first.
        const option1 = (async () => {
            const result = this.collectInterpreterDetails(pythonPath, resource);
            await sleep(1000); // let the other option complete within 1s if possible.
            return result;
        })();

        // This is the preferred approach, hence the delay in option 1.
        const option2 = (async () => {
            const interpreters = await this.getInterpreters(resource);
            const found = interpreters.find((i) => fs.arePathsSame(i.path, pythonPath));
            if (found) {
                // Cache the interpreter info, only if we get the data from interpretr list.
                // tslint:disable-next-line:no-any
                (found as any).__store = true;
                return found;
            }
            // Use option1 as a fallback.
            return option1;
        })();

        // Get the first one that doesn't return undefined
        let interpreterInfo = await Promise.race([option2, option1]);
        if (!interpreterInfo) {
            // If undefined, wait for both
            const both = await Promise.all([option1, option2]);
            interpreterInfo = both[0] ? both[0] : both[1];
        }

        // tslint:disable-next-line:no-any
        if (interpreterInfo && (interpreterInfo as any).__store) {
            await this.updateCachedInterpreterInformation(interpreterInfo, resource);
        }
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
        // faster than calculating file has agian and again, only when deailing with cached items.
        if (!info.cachedEntry && info.path && this.inMemoryCacheOfDisplayNames.has(info.path)) {
            return this.inMemoryCacheOfDisplayNames.get(info.path)!;
        }
        const fileHash = (info.path ? await this.getInterepreterFileHash(info.path).catch(() => '') : '') || '';
        // Do not include dipslay name into hash as that changes.
        const interpreterHash = `${fileHash}-${md5(JSON.stringify({ ...info, displayName: '' }))}`;
        const store = this.persistentStateFactory.createGlobalPersistentState<{ hash: string; displayName: string }>(
            `${info.path}.interpreter.displayName.v7`,
            undefined,
            EXPITY_DURATION
        );
        if (store.value && store.value.hash === interpreterHash && store.value.displayName) {
            this.inMemoryCacheOfDisplayNames.set(info.path!, store.value.displayName);
            return store.value.displayName;
        }

        const displayName = await this.buildInterpreterDisplayName(info, resource);

        // If dealing with cached entry, then do not store the display name in cache.
        if (!info.cachedEntry) {
            await store.updateValue({ displayName, hash: interpreterHash });
            this.inMemoryCacheOfDisplayNames.set(info.path!, displayName);
        }

        return displayName;
    }
    public async getInterpreterCache(
        pythonPath: string
    ): Promise<IPersistentState<{ fileHash: string; info?: PythonInterpreter }>> {
        const fileHash = (pythonPath ? await this.getInterepreterFileHash(pythonPath).catch(() => '') : '') || '';
        const store = this.persistentStateFactory.createGlobalPersistentState<{
            fileHash: string;
            info?: PythonInterpreter;
        }>(`${pythonPath}.interpreter.Details.v7`, undefined, EXPITY_DURATION);
        if (!store.value || store.value.fileHash !== fileHash) {
            await store.updateValue({ fileHash });
        }
        return store;
    }
    public _onConfigChanged = (resource?: Uri) => {
        // Check if we actually changed our python path
        const pySettings = this.configService.getSettings(resource);
        if (this._pythonPathSetting === '' || this._pythonPathSetting !== pySettings.pythonPath) {
            this._pythonPathSetting = pySettings.pythonPath;
            this.didChangeInterpreterEmitter.fire();
            const interpreterDisplay = this.serviceContainer.get<IInterpreterDisplay>(IInterpreterDisplay);
            interpreterDisplay.refresh().catch((ex) => traceError('Python Extension: display.refresh', ex));
        }
    };
    protected async getInterepreterFileHash(pythonPath: string): Promise<string> {
        return this.hashProviderFactory
            .create({ pythonPath })
            .then((provider) => provider.getInterpreterHash(pythonPath));
    }
    protected async updateCachedInterpreterInformation(info: PythonInterpreter, resource: Resource): Promise<void> {
        const key = JSON.stringify(info);
        if (this.updatedInterpreters.has(key)) {
            return;
        }
        this.updatedInterpreters.add(key);
        const state = await this.getInterpreterCache(info.path);
        info.displayName = await this.getDisplayName(info, resource);
        // Check if info has indeed changed.
        if (state.value && state.value.info && JSON.stringify(info) === JSON.stringify(state.value.info)) {
            return;
        }
        this.inMemoryCacheOfDisplayNames.delete(info.path);
        await state.updateValue({ fileHash: state.value.fileHash, info });
        this.didChangeInterpreterInformation.fire(info);
    }
    protected async buildInterpreterDisplayName(info: Partial<PythonInterpreter>, resource?: Uri): Promise<string> {
        const displayNameParts: string[] = ['Python'];
        const envSuffixParts: string[] = [];

        if (info.version) {
            displayNameParts.push(`${info.version.major}.${info.version.minor}.${info.version.patch}`);
        }
        if (info.architecture) {
            displayNameParts.push(getArchitectureDisplayName(info.architecture));
        }
        if (!info.envName && info.path && info.type && info.type === InterpreterType.Pipenv) {
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

        const envSuffix = envSuffixParts.length === 0 ? '' : `(${envSuffixParts.join(': ')})`;
        return `${displayNameParts.join(' ')} ${envSuffix}`.trim();
    }
    private async collectInterpreterDetails(pythonPath: string, resource: Uri | undefined) {
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

        const envName =
            type === InterpreterType.Unknown
                ? undefined
                : await virtualEnvManager.getEnvironmentName(pythonPath, resource);
        const pthonInfo = {
            ...(details as PythonInterpreter),
            envName
        };
        pthonInfo.displayName = await this.getDisplayName(pthonInfo, resource);
        return pthonInfo;
    }
}
