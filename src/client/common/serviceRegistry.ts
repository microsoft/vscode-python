// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IServiceManager } from '../ioc/types';
import { ApplicationShell } from './application/applicationShell';
import { CommandManager } from './application/commandManager';
import { DocumentManager } from './application/documentManager';
import { TerminalManager } from './application/terminalManager';
import { IApplicationShell, ICommandManager, IDocumentManager, ITerminalManager, IWorkspaceService } from './application/types';
import { WorkspaceService } from './application/workspace';
import { ConfigurationService } from './configuration/service';
import { Installer } from './installer/installer';
import { Logger } from './logger';
import { PersistentStateFactory } from './persistentState';
import { IS_64_BIT, IS_WINDOWS } from './platform/constants';
import { PathUtils } from './platform/pathUtils';
import { CurrentProcess } from './process/currentProcess';
import { TerminalServiceFactory } from './terminal/factory';
import { TerminalHelper } from './terminal/helper';
import { TerminalService } from './terminal/service';
import { ITerminalHelper, ITerminalService, ITerminalServiceFactory } from './terminal/types';
import { IConfigurationService, ICurrentProcess, IInstaller, ILogger, IPathUtils, IPersistentStateFactory, Is64Bit, IsWindows } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingletonInstance<boolean>(IsWindows, IS_WINDOWS);
    serviceManager.addSingletonInstance<boolean>(Is64Bit, IS_64_BIT);

    serviceManager.addSingleton<IPersistentStateFactory>(IPersistentStateFactory, PersistentStateFactory);
    serviceManager.addSingleton<ILogger>(ILogger, Logger);
    serviceManager.addSingleton<ITerminalService>(ITerminalService, TerminalService);
    serviceManager.addSingleton<ITerminalServiceFactory>(ITerminalServiceFactory, TerminalServiceFactory);
    serviceManager.addSingleton<ITerminalHelper>(ITerminalHelper, TerminalHelper);
    serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);
    serviceManager.addSingleton<IApplicationShell>(IApplicationShell, ApplicationShell);
    serviceManager.addSingleton<ICurrentProcess>(ICurrentProcess, CurrentProcess);
    serviceManager.addSingleton<IInstaller>(IInstaller, Installer);
    serviceManager.addSingleton<ICommandManager>(ICommandManager, CommandManager);
    serviceManager.addSingleton<IConfigurationService>(IConfigurationService, ConfigurationService);
    serviceManager.addSingleton<IWorkspaceService>(IWorkspaceService, WorkspaceService);
    serviceManager.addSingleton<IDocumentManager>(IDocumentManager, DocumentManager);
    serviceManager.addSingleton<ITerminalManager>(ITerminalManager, TerminalManager);
}
