// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Random } from '../../utils/random';
import { IHttpClient } from '../activation/types';
import { IServiceManager } from '../ioc/types';
import { ApplicationEnvironment } from './application/applicationEnvironment';
import { ApplicationShell } from './application/applicationShell';
import { CommandManager } from './application/commandManager';
import { DebugService } from './application/debugService';
import { DocumentManager } from './application/documentManager';
import { TerminalManager } from './application/terminalManager';
import {
    IApplicationEnvironment, IApplicationShell, ICommandManager,
    IDebugService, IDocumentManager, ITerminalManager, IWorkspaceService
} from './application/types';
import { WorkspaceService } from './application/workspace';
import { ConfigurationService } from './configuration/service';
import { EditorUtils } from './editor';
import { FeatureDeprecationManager } from './featureDeprecationManager';
import { ProductInstaller } from './installer/productInstaller';
import { Logger } from './logger';
import { BrowserService } from './net/browser';
import { HttpClient } from './net/httpClient';
import { NugetService } from './nuget/nugetService';
import { INugetService } from './nuget/types';
import { PersistentStateFactory } from './persistentState';
import { IS_64_BIT, IS_WINDOWS } from './platform/constants';
import { PathUtils } from './platform/pathUtils';
import { CurrentProcess } from './process/currentProcess';
import { Bash } from './terminal/environmentActivationProviders/bash';
import {
    CommandPromptAndPowerShell
} from './terminal/environmentActivationProviders/commandPrompt';
import { PyEnvActivationCommandProvider } from './terminal/environmentActivationProviders/pyenvActivationProvider';
import { TerminalServiceFactory } from './terminal/factory';
import { TerminalHelper } from './terminal/helper';
import {
    ITerminalActivationCommandProvider,
    ITerminalHelper, ITerminalServiceFactory
} from './terminal/types';
import {
    IBrowserService, IConfigurationService,
    ICurrentProcess, IEditorUtils, IFeatureDeprecationManager,
    IInstaller, ILogger,
    IPathUtils, IPersistentStateFactory, IRandom, Is64Bit, IsWindows
} from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingletonInstance<boolean>(IsWindows, IS_WINDOWS);
    serviceManager.addSingletonInstance<boolean>(Is64Bit, IS_64_BIT);

    serviceManager.addSingleton<IRandom>(IRandom, Random);
    serviceManager.addSingleton<IPersistentStateFactory>(IPersistentStateFactory, PersistentStateFactory);
    serviceManager.addSingleton<ILogger>(ILogger, Logger);
    serviceManager.addSingleton<ITerminalServiceFactory>(ITerminalServiceFactory, TerminalServiceFactory);
    serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);
    serviceManager.addSingleton<IApplicationShell>(IApplicationShell, ApplicationShell);
    serviceManager.addSingleton<ICurrentProcess>(ICurrentProcess, CurrentProcess);
    serviceManager.addSingleton<IInstaller>(IInstaller, ProductInstaller);
    serviceManager.addSingleton<ICommandManager>(ICommandManager, CommandManager);
    serviceManager.addSingleton<IConfigurationService>(IConfigurationService, ConfigurationService);
    serviceManager.addSingleton<IWorkspaceService>(IWorkspaceService, WorkspaceService);
    serviceManager.addSingleton<IDocumentManager>(IDocumentManager, DocumentManager);
    serviceManager.addSingleton<ITerminalManager>(ITerminalManager, TerminalManager);
    serviceManager.addSingleton<IDebugService>(IDebugService, DebugService);
    serviceManager.addSingleton<IApplicationEnvironment>(IApplicationEnvironment, ApplicationEnvironment);
    serviceManager.addSingleton<IBrowserService>(IBrowserService, BrowserService);
    serviceManager.addSingleton<IHttpClient>(IHttpClient, HttpClient);
    serviceManager.addSingleton<IEditorUtils>(IEditorUtils, EditorUtils);
    serviceManager.addSingleton<INugetService>(INugetService, NugetService);

    serviceManager.addSingleton<ITerminalHelper>(ITerminalHelper, TerminalHelper);
    serviceManager.addSingleton<ITerminalActivationCommandProvider>(
        ITerminalActivationCommandProvider, Bash, 'bashCShellFish');
    serviceManager.addSingleton<ITerminalActivationCommandProvider>(
        ITerminalActivationCommandProvider, CommandPromptAndPowerShell, 'commandPromptAndPowerShell');
    serviceManager.addSingleton<ITerminalActivationCommandProvider>(
        ITerminalActivationCommandProvider, PyEnvActivationCommandProvider, 'pyenv');
    serviceManager.addSingleton<IFeatureDeprecationManager>(IFeatureDeprecationManager, FeatureDeprecationManager);
}
