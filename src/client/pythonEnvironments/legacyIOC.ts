// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-use-before-declare max-classes-per-file

import { inject, injectable, named, optional } from 'inversify';
import { SemVer } from 'semver';
import { Disposable, Event, Uri } from 'vscode';
import { IWorkspaceService } from '../common/application/types';
import { IFileSystem, IPlatformService, IRegistry } from '../common/platform/types';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../common/process/types';
import { IConfigurationService, IDisposableRegistry, IPersistentStateFactory, Resource } from '../common/types';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    GLOBAL_VIRTUAL_ENV_SERVICE,
    ICondaService,
    IInterpreterHelper,
    IInterpreterLocatorHelper,
    IInterpreterLocatorProgressService,
    IInterpreterLocatorService,
    IInterpreterWatcher,
    IInterpreterWatcherBuilder,
    IInterpreterWatcherRegistry,
    IKnownSearchPathsForInterpreters,
    INTERPRETER_LOCATOR_SERVICE,
    IPipEnvService,
    IVirtualEnvironmentsSearchPathProvider,
    KNOWN_PATH_SERVICE,
    PIPENV_SERVICE,
    WINDOWS_REGISTRY_SERVICE,
    WORKSPACE_VIRTUAL_ENV_SERVICE
} from '../interpreter/contracts';
import {
    IInterpreterHashProvider,
    IInterpreterHashProviderFactory,
    IPipEnvServiceHelper,
    IPythonInPathCommandProvider,
    IWindowsStoreHashProvider,
    IWindowsStoreInterpreter
} from '../interpreter/locators/types';
import { IServiceContainer, IServiceManager } from '../ioc/types';
import { PythonInterpreterLocatorService } from './discovery/locators';
import { InterpreterLocatorHelper } from './discovery/locators/helpers';
import { InterpreterLocatorProgressService } from './discovery/locators/progressService';
import { CondaEnvironmentInfo, CondaInfo } from './discovery/locators/services/conda';
import { CondaEnvFileService } from './discovery/locators/services/condaEnvFileService';
import { CondaEnvService } from './discovery/locators/services/condaEnvService';
import { CondaService } from './discovery/locators/services/condaService';
import { CurrentPathService, PythonInPathCommandProvider } from './discovery/locators/services/currentPathService';
import {
    GlobalVirtualEnvironmentsSearchPathProvider,
    GlobalVirtualEnvService
} from './discovery/locators/services/globalVirtualEnvService';
import { InterpreterHashProvider } from './discovery/locators/services/hashProvider';
import { InterpreterHashProviderFactory } from './discovery/locators/services/hashProviderFactory';
import { InterpreterWatcherBuilder } from './discovery/locators/services/interpreterWatcherBuilder';
import { KnownPathsService, KnownSearchPathsForInterpreters } from './discovery/locators/services/KnownPathsService';
import { PipEnvService } from './discovery/locators/services/pipEnvService';
import { PipEnvServiceHelper } from './discovery/locators/services/pipEnvServiceHelper';
import { WindowsRegistryService } from './discovery/locators/services/windowsRegistryService';
import { WindowsStoreInterpreter } from './discovery/locators/services/windowsStoreInterpreter';
import {
    WorkspaceVirtualEnvironmentsSearchPathProvider,
    WorkspaceVirtualEnvService
} from './discovery/locators/services/workspaceVirtualEnvService';
import { WorkspaceVirtualEnvWatcherService } from './discovery/locators/services/workspaceVirtualEnvWatcherService';
import { GetInterpreterLocatorOptions } from './discovery/locators/types';
import { PythonInterpreter } from './info';

export function registerForIOC(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IInterpreterLocatorHelper>(IInterpreterLocatorHelper, InterpreterLocatorHelperProxy);
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        PythonInterpreterLocatorServiceProxy,
        INTERPRETER_LOCATOR_SERVICE
    );
    serviceManager.addSingleton<IInterpreterLocatorProgressService>(
        IInterpreterLocatorProgressService,
        InterpreterLocatorProgressServiceProxy
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        CondaEnvFileServiceProxy,
        CONDA_ENV_FILE_SERVICE
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        CondaEnvServiceProxy,
        CONDA_ENV_SERVICE
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        CurrentPathServiceProxy,
        CURRENT_PATH_SERVICE
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        GlobalVirtualEnvServiceProxy,
        GLOBAL_VIRTUAL_ENV_SERVICE
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        WorkspaceVirtualEnvServiceProxy,
        WORKSPACE_VIRTUAL_ENV_SERVICE
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        PipEnvLocatorServiceProxy,
        PIPENV_SERVICE
    );

    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        WindowsRegistryServiceProxy,
        WINDOWS_REGISTRY_SERVICE
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        KnownPathsServiceProxy,
        KNOWN_PATH_SERVICE
    );
    serviceManager.addSingleton<ICondaService>(ICondaService, CondaServiceProxy);
    serviceManager.addSingleton<IPipEnvService>(IPipEnvService, PipEnvServiceProxy);
    serviceManager.addSingleton<IPipEnvServiceHelper>(IPipEnvServiceHelper, PipEnvServiceHelperProxy);
    serviceManager.addSingleton<IPythonInPathCommandProvider>(
        IPythonInPathCommandProvider,
        PythonInPathCommandProviderProxy
    );

    serviceManager.add<IInterpreterWatcherRegistry>(
        IInterpreterWatcherRegistry,
        WorkspaceVirtualEnvWatcherServiceProxy,
        WORKSPACE_VIRTUAL_ENV_SERVICE
    );
    serviceManager.addSingleton<IWindowsStoreInterpreter>(IWindowsStoreInterpreter, WindowsStoreInterpreterProxy);
    serviceManager.addSingleton<IWindowsStoreHashProvider>(IWindowsStoreHashProvider, WindowsStoreInterpreterProxy);
    serviceManager.addSingleton<IInterpreterHashProvider>(IInterpreterHashProvider, InterpreterHashProviderProxy);
    serviceManager.addSingleton<IInterpreterHashProviderFactory>(
        IInterpreterHashProviderFactory,
        InterpreterHashProviderFactoryProxy
    );
    serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(
        IVirtualEnvironmentsSearchPathProvider,
        GlobalVirtualEnvironmentsSearchPathProviderProxy,
        'global'
    );
    serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(
        IVirtualEnvironmentsSearchPathProvider,
        WorkspaceVirtualEnvironmentsSearchPathProviderProxy,
        'workspace'
    );
    serviceManager.addSingleton<IKnownSearchPathsForInterpreters>(
        IKnownSearchPathsForInterpreters,
        KnownSearchPathsForInterpretersProxy
    );
    serviceManager.addSingleton<IInterpreterWatcherBuilder>(IInterpreterWatcherBuilder, InterpreterWatcherBuilderProxy);
}

@injectable()
class InterpreterLocatorHelperProxy implements IInterpreterLocatorHelper {
    private readonly impl: IInterpreterLocatorHelper;
    constructor(
        @inject(IFileSystem) fs: IFileSystem,
        @inject(IPipEnvServiceHelper) pipEnvServiceHelper: IPipEnvServiceHelper
    ) {
        this.impl = new InterpreterLocatorHelper(fs, pipEnvServiceHelper);
    }
    public async mergeInterpreters(interpreters: PythonInterpreter[]): Promise<PythonInterpreter[]> {
        return this.impl.mergeInterpreters(interpreters);
    }
}

@injectable()
class InterpreterLocatorProgressServiceProxy implements IInterpreterLocatorProgressService {
    private readonly impl: IInterpreterLocatorProgressService;
    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IDisposableRegistry) disposables: Disposable[]
    ) {
        this.impl = new InterpreterLocatorProgressService(serviceContainer, disposables);
    }

    public get onRefreshing(): Event<void> {
        return this.impl.onRefreshing;
    }
    public get onRefreshed(): Event<void> {
        return this.impl.onRefreshed;
    }
    public register(): void {
        this.impl.register();
    }
}

@injectable()
class InterpreterHashProviderFactoryProxy implements IInterpreterHashProviderFactory {
    private readonly impl: IInterpreterHashProviderFactory;
    constructor(
        @inject(IConfigurationService) configService: IConfigurationService,
        @inject(IWindowsStoreInterpreter) windowsStoreInterpreter: IWindowsStoreInterpreter,
        @inject(IWindowsStoreHashProvider) windowsStoreHashProvider: IWindowsStoreHashProvider,
        @inject(IInterpreterHashProvider) hashProvider: IInterpreterHashProvider
    ) {
        this.impl = new InterpreterHashProviderFactory(
            configService,
            windowsStoreInterpreter,
            windowsStoreHashProvider,
            hashProvider
        );
    }
    public async create(options: { pythonPath: string } | { resource: Uri }): Promise<IInterpreterHashProvider> {
        return this.impl.create(options);
    }
}

@injectable()
class InterpreterHashProviderProxy implements IInterpreterHashProvider {
    private readonly impl: IInterpreterHashProvider;
    constructor(@inject(IFileSystem) fs: IFileSystem) {
        this.impl = new InterpreterHashProvider(fs);
    }
    public async getInterpreterHash(pythonPath: string): Promise<string> {
        return this.impl.getInterpreterHash(pythonPath);
    }
}

@injectable()
class WindowsStoreInterpreterProxy implements IWindowsStoreInterpreter, IWindowsStoreHashProvider {
    private readonly impl: IWindowsStoreInterpreter & IWindowsStoreHashProvider;
    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IPersistentStateFactory) persistentFactory: IPersistentStateFactory,
        @inject(IFileSystem) fs: IFileSystem
    ) {
        this.impl = new WindowsStoreInterpreter(serviceContainer, persistentFactory, fs);
    }
    public isWindowsStoreInterpreter(pythonPath: string): boolean {
        return this.impl.isWindowsStoreInterpreter(pythonPath);
    }
    public isHiddenInterpreter(pythonPath: string): boolean {
        return this.impl.isHiddenInterpreter(pythonPath);
    }
    public async getInterpreterHash(pythonPath: string): Promise<string> {
        return this.impl.getInterpreterHash(pythonPath);
    }
}

@injectable()
class PythonInPathCommandProviderProxy implements IPythonInPathCommandProvider {
    private readonly impl: IPythonInPathCommandProvider;
    constructor(@inject(IPlatformService) platform: IPlatformService) {
        this.impl = new PythonInPathCommandProvider(platform);
    }
    public getCommands(): { command: string; args?: string[] }[] {
        return this.impl.getCommands();
    }
}

@injectable()
class KnownSearchPathsForInterpretersProxy implements IKnownSearchPathsForInterpreters {
    private readonly impl: IKnownSearchPathsForInterpreters;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.impl = new KnownSearchPathsForInterpreters(serviceContainer);
    }
    public getSearchPaths(): string[] {
        return this.impl.getSearchPaths();
    }
}

@injectable()
class WorkspaceVirtualEnvironmentsSearchPathProviderProxy implements IVirtualEnvironmentsSearchPathProvider {
    private readonly impl: IVirtualEnvironmentsSearchPathProvider;
    public constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.impl = new WorkspaceVirtualEnvironmentsSearchPathProvider(serviceContainer);
    }
    public async getSearchPaths(resource?: Uri): Promise<string[]> {
        return this.impl.getSearchPaths(resource);
    }
}

@injectable()
class GlobalVirtualEnvironmentsSearchPathProviderProxy implements IVirtualEnvironmentsSearchPathProvider {
    private readonly impl: IVirtualEnvironmentsSearchPathProvider;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.impl = new GlobalVirtualEnvironmentsSearchPathProvider(serviceContainer);
    }
    public async getSearchPaths(resource?: Uri): Promise<string[]> {
        return this.impl.getSearchPaths(resource);
    }
}

@injectable()
class PipEnvServiceProxy {
    private readonly impl: IPipEnvService;
    constructor(@inject(IInterpreterLocatorService) @named(PIPENV_SERVICE) proxy: IPipEnvService) {
        // tslint:disable-next-line:no-any
        const locator = (proxy as unknown) as any;
        this.impl = locator.pipEnvService;
    }
    public async isRelatedPipEnvironment(dir: string, pythonPath: string): Promise<boolean> {
        return this.impl.isRelatedPipEnvironment(dir, pythonPath);
    }
    public get executable(): string {
        return this.impl.executable;
    }
}

@injectable()
class PipEnvServiceHelperProxy implements IPipEnvServiceHelper {
    private readonly impl: IPipEnvServiceHelper;
    constructor(
        @inject(IPersistentStateFactory) statefactory: IPersistentStateFactory,
        @inject(IFileSystem) fs: IFileSystem
    ) {
        this.impl = new PipEnvServiceHelper(statefactory, fs);
    }
    public async getPipEnvInfo(pythonPath: string): Promise<{ workspaceFolder: Uri; envName: string } | undefined> {
        return this.impl.getPipEnvInfo(pythonPath);
    }
    public async trackWorkspaceFolder(pythonPath: string, workspaceFolder: Uri): Promise<void> {
        return this.impl.trackWorkspaceFolder(pythonPath, workspaceFolder);
    }
}

@injectable()
class CondaServiceProxy implements ICondaService {
    private readonly impl: ICondaService;
    constructor(
        @inject(IProcessServiceFactory) processServiceFactory: IProcessServiceFactory,
        @inject(IPlatformService) platform: IPlatformService,
        @inject(IFileSystem) fileSystem: IFileSystem,
        @inject(IPersistentStateFactory) persistentStateFactory: IPersistentStateFactory,
        @inject(IConfigurationService) configService: IConfigurationService,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(IInterpreterLocatorService)
        @named(WINDOWS_REGISTRY_SERVICE)
        @optional()
        registryLookupForConda?: IInterpreterLocatorService
    ) {
        this.impl = new CondaService(
            processServiceFactory,
            platform,
            fileSystem,
            persistentStateFactory,
            configService,
            disposableRegistry,
            workspaceService,
            registryLookupForConda
        );
    }
    public get condaEnvironmentsFile(): string | undefined {
        return this.impl.condaEnvironmentsFile;
    }
    public async getCondaFile(): Promise<string> {
        return this.impl.getCondaFile();
    }
    public async isCondaAvailable(): Promise<boolean> {
        return this.impl.isCondaAvailable();
    }
    public async getCondaVersion(): Promise<SemVer | undefined> {
        return this.impl.getCondaVersion();
    }
    public async getCondaInfo(): Promise<CondaInfo | undefined> {
        return this.impl.getCondaInfo();
    }
    public async getCondaEnvironments(ignoreCache: boolean): Promise<CondaEnvironmentInfo[] | undefined> {
        return this.impl.getCondaEnvironments(ignoreCache);
    }
    public getInterpreterPath(condaEnvironmentPath: string): string {
        return this.impl.getInterpreterPath(condaEnvironmentPath);
    }
    public async getCondaFileFromInterpreter(interpreterPath?: string, envName?: string): Promise<string | undefined> {
        return this.impl.getCondaFileFromInterpreter(interpreterPath, envName);
    }
    public async isCondaEnvironment(interpreterPath: string): Promise<boolean> {
        return this.impl.isCondaEnvironment(interpreterPath);
    }
    public async getCondaEnvironment(interpreterPath: string): Promise<{ name: string; path: string } | undefined> {
        return this.impl.getCondaEnvironment(interpreterPath);
    }
}

@injectable()
class InterpreterWatcherBuilderProxy implements IInterpreterWatcherBuilder {
    private readonly impl: IInterpreterWatcherBuilder;
    constructor(
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(IServiceContainer) serviceContainer: IServiceContainer
    ) {
        this.impl = new InterpreterWatcherBuilder(workspaceService, serviceContainer);
    }
    public async getWorkspaceVirtualEnvInterpreterWatcher(resource: Uri | undefined): Promise<IInterpreterWatcher> {
        return this.impl.getWorkspaceVirtualEnvInterpreterWatcher(resource);
    }
}

@injectable()
class WorkspaceVirtualEnvWatcherServiceProxy implements IInterpreterWatcherRegistry, Disposable {
    private readonly impl: IInterpreterWatcherRegistry & Disposable;
    constructor(
        @inject(IDisposableRegistry) disposableRegistry: Disposable[],
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(IPlatformService) platformService: IPlatformService,
        @inject(IPythonExecutionFactory) pythonExecFactory: IPythonExecutionFactory
    ) {
        this.impl = new WorkspaceVirtualEnvWatcherService(
            disposableRegistry,
            workspaceService,
            platformService,
            pythonExecFactory
        );
    }
    public get onDidCreate(): Event<Resource> {
        return this.impl.onDidCreate;
    }
    public async register(resource: Resource): Promise<void> {
        return this.impl.register(resource);
    }
    public dispose() {
        return this.impl.dispose();
    }
}

//===========================
// locators

@injectable()
class BaseLocatorServiceProxy implements IInterpreterLocatorService {
    constructor(protected readonly impl: IInterpreterLocatorService) {}
    public dispose() {
        this.impl.dispose();
    }
    public get onLocating(): Event<Promise<PythonInterpreter[]>> {
        return this.impl.onLocating;
    }
    public get hasInterpreters(): Promise<boolean> {
        return this.impl.hasInterpreters;
    }
    public get didTriggerInterpreterSuggestions(): boolean {
        return this.impl.didTriggerInterpreterSuggestions as boolean;
    }
    public set didTriggerInterpreterSuggestions(value: boolean) {
        this.impl.didTriggerInterpreterSuggestions = value;
    }
    public async getInterpreters(resource?: Uri, options?: GetInterpreterLocatorOptions): Promise<PythonInterpreter[]> {
        return this.impl.getInterpreters(resource, options);
    }
}

@injectable()
class PythonInterpreterLocatorServiceProxy extends BaseLocatorServiceProxy {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(new PythonInterpreterLocatorService(serviceContainer));
        serviceContainer.get<Disposable[]>(IDisposableRegistry).push(this.impl);
    }
}

@injectable()
class CondaEnvFileServiceProxy extends BaseLocatorServiceProxy {
    constructor(
        @inject(IInterpreterHelper) helperService: IInterpreterHelper,
        @inject(ICondaService) condaService: ICondaService,
        @inject(IFileSystem) fileSystem: IFileSystem,
        @inject(IServiceContainer) serviceContainer: IServiceContainer
    ) {
        super(new CondaEnvFileService(helperService, condaService, fileSystem, serviceContainer));
    }
}

@injectable()
class CondaEnvServiceProxy extends BaseLocatorServiceProxy {
    constructor(
        @inject(ICondaService) condaService: ICondaService,
        @inject(IInterpreterHelper) helper: IInterpreterHelper,
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IFileSystem) fileSystem: IFileSystem
    ) {
        super(new CondaEnvService(condaService, helper, serviceContainer, fileSystem));
    }
}

@injectable()
class CurrentPathServiceProxy extends BaseLocatorServiceProxy {
    constructor(
        @inject(IInterpreterHelper) helper: IInterpreterHelper,
        @inject(IProcessServiceFactory) processServiceFactory: IProcessServiceFactory,
        @inject(IPythonInPathCommandProvider) pythonCommandProvider: IPythonInPathCommandProvider,
        @inject(IServiceContainer) serviceContainer: IServiceContainer
    ) {
        super(new CurrentPathService(helper, processServiceFactory, pythonCommandProvider, serviceContainer));
    }
}

@injectable()
class GlobalVirtualEnvServiceProxy extends BaseLocatorServiceProxy {
    public constructor(
        @inject(IVirtualEnvironmentsSearchPathProvider)
        @named('global')
        globalVirtualEnvPathProvider: IVirtualEnvironmentsSearchPathProvider,
        @inject(IServiceContainer) serviceContainer: IServiceContainer
    ) {
        super(new GlobalVirtualEnvService(globalVirtualEnvPathProvider, serviceContainer));
    }
}

@injectable()
class WorkspaceVirtualEnvServiceProxy extends BaseLocatorServiceProxy {
    public constructor(
        @inject(IVirtualEnvironmentsSearchPathProvider)
        @named('workspace')
        workspaceVirtualEnvPathProvider: IVirtualEnvironmentsSearchPathProvider,
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IInterpreterWatcherBuilder) builder: IInterpreterWatcherBuilder
    ) {
        super(new WorkspaceVirtualEnvService(workspaceVirtualEnvPathProvider, serviceContainer, builder));
    }
}

@injectable()
class KnownPathsServiceProxy extends BaseLocatorServiceProxy {
    public constructor(
        @inject(IKnownSearchPathsForInterpreters) knownSearchPaths: IKnownSearchPathsForInterpreters,
        @inject(IInterpreterHelper) helper: IInterpreterHelper,
        @inject(IServiceContainer) serviceContainer: IServiceContainer
    ) {
        super(new KnownPathsService(knownSearchPaths, helper, serviceContainer));
    }
}

@injectable()
class PipEnvLocatorServiceProxy extends BaseLocatorServiceProxy {
    // This is only meant for consumption by PipEnvServiceProxy.
    public readonly pipEnvService: IPipEnvService;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(new PipEnvService(serviceContainer));
        this.pipEnvService = (this.impl as unknown) as IPipEnvService;
    }
}

@injectable()
class WindowsRegistryServiceProxy extends BaseLocatorServiceProxy {
    constructor(
        @inject(IRegistry) registry: IRegistry,
        @inject(IPlatformService) platform: IPlatformService,
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IWindowsStoreInterpreter) windowsStoreInterpreter: IWindowsStoreInterpreter
    ) {
        super(new WindowsRegistryService(registry, platform, serviceContainer, windowsStoreInterpreter));
    }
}
