// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { Uri } from 'vscode';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    GLOBAL_VIRTUAL_ENV_SERVICE,
    ICondaService,
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
    WORKSPACE_VIRTUAL_ENV_SERVICE,
} from '../interpreter/contracts';
import { IPipEnvServiceHelper, IPythonInPathCommandProvider } from '../interpreter/locators/types';
//import { GetInterpreterOptions } from '../interpreter/interpreterService';
import { IServiceContainer, IServiceManager } from '../ioc/types';
import { initializeExternalDependencies } from './common/externalDependencies';
import { PythonInterpreterLocatorService } from './discovery/locators';
import { InterpreterLocatorHelper } from './discovery/locators/helpers';
import { InterpreterLocatorProgressService } from './discovery/locators/progressService';
import { CondaEnvironmentInfo } from './discovery/locators/services/conda';
import { CondaEnvFileService } from './discovery/locators/services/condaEnvFileService';
import { CondaEnvService } from './discovery/locators/services/condaEnvService';
import { CondaService } from './discovery/locators/services/condaService';
import { CurrentPathService, PythonInPathCommandProvider } from './discovery/locators/services/currentPathService';
import {
    GlobalVirtualEnvironmentsSearchPathProvider,
    GlobalVirtualEnvService,
} from './discovery/locators/services/globalVirtualEnvService';
import { InterpreterHashProvider } from './discovery/locators/services/hashProvider';
import { InterpeterHashProviderFactory } from './discovery/locators/services/hashProviderFactory';
import { InterpreterWatcherBuilder } from './discovery/locators/services/interpreterWatcherBuilder';
import { KnownPathsService, KnownSearchPathsForInterpreters } from './discovery/locators/services/KnownPathsService';
import { PipEnvService } from './discovery/locators/services/pipEnvService';
import { PipEnvServiceHelper } from './discovery/locators/services/pipEnvServiceHelper';
import { WindowsRegistryService } from './discovery/locators/services/windowsRegistryService';
import { WindowsStoreInterpreter } from './discovery/locators/services/windowsStoreInterpreter';
import {
    WorkspaceVirtualEnvironmentsSearchPathProvider,
    WorkspaceVirtualEnvService,
} from './discovery/locators/services/workspaceVirtualEnvService';
import { WorkspaceVirtualEnvWatcherService } from './discovery/locators/services/workspaceVirtualEnvWatcherService';
import { GetInterpreterLocatorOptions } from './discovery/locators/types';
import { PythonEnvironment } from './info';
import { EnvironmentInfoService, IEnvironmentInfoService } from './info/environmentInfoService';

import { PythonEnvironments } from '.';

export const IComponentAdapter = Symbol('IComponentAdapter');
export interface IComponentAdapter {
    // IInterpreterService
    hasInterpreters: Promise<boolean>;
    //getInterpreters(_resource?: vscode.Uri, _options?: GetInterpreterOptions): Promise<PythonEnvironment[]>;
    getInterpreterDetails(pythonPath: string, _resource?: vscode.Uri): Promise<undefined | PythonEnvironment>;
    // IInterpreterLocatorService
    getInterpreters(resource?: vscode.Uri, options?: GetInterpreterLocatorOptions): Promise<PythonEnvironment[]>;
    // IInterpreterHelper
    getInterpreterInformation(pythonPath: string): Promise<undefined | Partial<PythonEnvironment>>;
    isMacDefaultPythonPath(pythonPath: string): Promise<boolean | undefined>;
    // ICondaService
    isCondaEnvironment(interpreterPath: string): Promise<boolean | undefined>;
    getCondaEnvironment(interpreterPath: string): Promise<CondaEnvironmentInfo | undefined>;
    // IWindowsStoreInterpreter
    isWindowsStoreInterpreter(pythonPath: string): Promise<boolean | undefined>;
}

@injectable()
class ComponentAdapter implements IComponentAdapter {
    constructor(
        // The adapter only wraps one thing: the component API.
        private readonly api: PythonEnvironments
    ) {
        // For the moment we use this placeholder to exercise the property.
        if (this.api.onChanged) {
            this.api.onChanged((_event) => {
                // do nothing
            });
        }
    }

    // IInterpreterHelper

    public async getInterpreterInformation(_pythonPath: string): Promise<undefined | Partial<PythonEnvironment>> {
        return undefined;
        // ...
    }

    public async isMacDefaultPythonPath(_pythonPath: string): Promise<boolean> {
        return false;
        // ...
    }

    // IInterpreterService

    public get hasInterpreters(): Promise<boolean> {
        return Promise.resolve(false);
        // ...
    }

    //public async getInterpreters(_resource?: Uri, _options?: GetInterpreterOptions): Promise<PythonEnvironment[]>;

    public async getInterpreterDetails(_pythonPath: string, _resource?: Uri): Promise<undefined | PythonEnvironment> {
        return undefined;
        // ...
    }

    // ICondaService

    public async isCondaEnvironment(_interpreterPath: string): Promise<boolean> {
        return false;
        // ...
    }

    public async getCondaEnvironment(_interpreterPath: string): Promise<CondaEnvironmentInfo | undefined> {
        return undefined;
        // ...
    }

    // IWindowsStoreInterpreter

    public isWindowsStoreInterpreter(_pythonPath: string): boolean {
        return false;
        // ...
    }

    // IInterpreterLocatorService

    public async getInterpreters(_resource?: Uri, _options?: GetInterpreterLocatorOptions): Promise<PythonEnvironment[]> {
        //{
        //    ignoreCache?: boolean
        //    onSuggestion?: boolean;
        //}
        return [];
        // ...
    }
}

export function registerForIOC(serviceManager: IServiceManager, serviceContainer: IServiceContainer, api: PythonEnvironments): void {
    const adapter = new ComponentAdapter(api);
    serviceManager.addSingletonInstance<IComponentAdapter>(IComponentAdapter, adapter);

    serviceManager.addSingleton<IInterpreterLocatorHelper>(IInterpreterLocatorHelper, InterpreterLocatorHelper);
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        PythonInterpreterLocatorService,
        INTERPRETER_LOCATOR_SERVICE,
    );
    serviceManager.addSingleton<IInterpreterLocatorProgressService>(
        IInterpreterLocatorProgressService,
        InterpreterLocatorProgressService,
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        CondaEnvFileService,
        CONDA_ENV_FILE_SERVICE,
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        CondaEnvService,
        CONDA_ENV_SERVICE,
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        CurrentPathService,
        CURRENT_PATH_SERVICE,
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        GlobalVirtualEnvService,
        GLOBAL_VIRTUAL_ENV_SERVICE,
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        WorkspaceVirtualEnvService,
        WORKSPACE_VIRTUAL_ENV_SERVICE,
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, PipEnvService, PIPENV_SERVICE);

    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        WindowsRegistryService,
        WINDOWS_REGISTRY_SERVICE,
    );
    serviceManager.addSingleton<IInterpreterLocatorService>(
        IInterpreterLocatorService,
        KnownPathsService,
        KNOWN_PATH_SERVICE,
    );
    serviceManager.addSingleton<ICondaService>(ICondaService, CondaService);
    serviceManager.addSingleton<IPipEnvServiceHelper>(IPipEnvServiceHelper, PipEnvServiceHelper);
    serviceManager.addSingleton<IPythonInPathCommandProvider>(
        IPythonInPathCommandProvider,
        PythonInPathCommandProvider,
    );

    serviceManager.add<IInterpreterWatcher>(
        IInterpreterWatcher,
        WorkspaceVirtualEnvWatcherService,
        WORKSPACE_VIRTUAL_ENV_SERVICE,
    );
    serviceManager.addSingleton<WindowsStoreInterpreter>(WindowsStoreInterpreter, WindowsStoreInterpreter);
    serviceManager.addSingleton<InterpreterHashProvider>(InterpreterHashProvider, InterpreterHashProvider);
    serviceManager.addSingleton<InterpeterHashProviderFactory>(
        InterpeterHashProviderFactory,
        InterpeterHashProviderFactory,
    );
    serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(
        IVirtualEnvironmentsSearchPathProvider,
        GlobalVirtualEnvironmentsSearchPathProvider,
        'global',
    );
    serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(
        IVirtualEnvironmentsSearchPathProvider,
        WorkspaceVirtualEnvironmentsSearchPathProvider,
        'workspace',
    );
    serviceManager.addSingleton<IKnownSearchPathsForInterpreters>(
        IKnownSearchPathsForInterpreters,
        KnownSearchPathsForInterpreters,
    );
    serviceManager.addSingleton<IInterpreterWatcherBuilder>(IInterpreterWatcherBuilder, InterpreterWatcherBuilder);

    serviceManager.addSingletonInstance<IEnvironmentInfoService>(IEnvironmentInfoService, new EnvironmentInfoService());
    initializeExternalDependencies(serviceContainer);
}
