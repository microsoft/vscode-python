// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Container } from 'inversify';
import { SocketServer } from '../common/net/socket/socketServer';
import { FileSystem } from '../common/platform/fileSystem';
import { PlatformService } from '../common/platform/platformService';
import { IFileSystem, IPlatformService } from '../common/platform/types';
import { CurrentProcess } from '../common/process/currentProcess';
import { ICurrentProcess, ISocketServer } from '../common/types';
import { ServiceContainer } from '../ioc/container';
import { ServiceManager } from '../ioc/serviceManager';
import { IServiceContainer, IServiceManager } from '../ioc/types';
import { DebuggerBanner } from './banner';
import { DebugStreamProvider } from './Common/debugStreamProvider';
import { ProtocolLogger } from './Common/protocolLogger';
import { ProtocolParser } from './Common/protocolParser';
import { ProtocolMessageWriter } from './Common/protocolWriter';
import { IDebuggerBanner, IDebugStreamProvider, IProtocolLogger, IProtocolMessageWriter, IProtocolParser } from './types';

export function initializeIoc(): IServiceContainer {
    const cont = new Container();
    const serviceManager = new ServiceManager(cont);
    const serviceContainer = new ServiceContainer(cont);
    serviceManager.addSingletonInstance<IServiceContainer>(IServiceContainer, serviceContainer);
    registerDebuggerTypes(serviceManager);
    return serviceContainer;
}

function registerDebuggerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<ICurrentProcess>(ICurrentProcess, CurrentProcess);
    serviceManager.addSingleton<IDebugStreamProvider>(IDebugStreamProvider, DebugStreamProvider);
    serviceManager.addSingleton<IProtocolLogger>(IProtocolLogger, ProtocolLogger);
    serviceManager.add<IProtocolParser>(IProtocolParser, ProtocolParser);
    serviceManager.addSingleton<IFileSystem>(IFileSystem, FileSystem);
    serviceManager.addSingleton<IPlatformService>(IPlatformService, PlatformService);
    serviceManager.addSingleton<ISocketServer>(ISocketServer, SocketServer);
    serviceManager.addSingleton<IProtocolMessageWriter>(IProtocolMessageWriter, ProtocolMessageWriter);
}

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IDebuggerBanner>(IDebuggerBanner, DebuggerBanner);
}
