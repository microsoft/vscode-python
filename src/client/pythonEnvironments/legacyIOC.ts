// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-use-before-declare max-classes-per-file

import { inject, injectable, named } from 'inversify';
import { Disposable, Event, Uri } from 'vscode';
import { IFileSystem, IPlatformService, IRegistry } from '../common/platform/types';
import { IProcessServiceFactory } from '../common/process/types';
import { IConfigurationService, IDisposableRegistry, IPersistentStateFactory } from '../common/types';
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
    IKnownSearchPathsForInterpreters,
    INTERPRETER_LOCATOR_SERVICE,
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
        PipEnvServiceProxy,
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
    serviceManager.addSingleton<ICondaService>(ICondaService, CondaService);
    serviceManager.addSingleton<IPipEnvServiceHelper>(IPipEnvServiceHelper, PipEnvServiceHelper);
    serviceManager.addSingleton<IPythonInPathCommandProvider>(
        IPythonInPathCommandProvider,
        PythonInPathCommandProviderProxy
    );

    serviceManager.add<IInterpreterWatcher>(
        IInterpreterWatcher,
        WorkspaceVirtualEnvWatcherService,
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
        GlobalVirtualEnvironmentsSearchPathProvider,
        'global'
    );
    serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(
        IVirtualEnvironmentsSearchPathProvider,
        WorkspaceVirtualEnvironmentsSearchPathProvider,
        'workspace'
    );
    serviceManager.addSingleton<IKnownSearchPathsForInterpreters>(
        IKnownSearchPathsForInterpreters,
        KnownSearchPathsForInterpretersProxy
    );
    serviceManager.addSingleton<IInterpreterWatcherBuilder>(IInterpreterWatcherBuilder, InterpreterWatcherBuilder);
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
    public get didTriggerInterpreterSuggestions(): boolean | undefined {
        return this.impl.didTriggerInterpreterSuggestions;
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
class PipEnvServiceProxy extends BaseLocatorServiceProxy {
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(new PipEnvService(serviceContainer));
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
