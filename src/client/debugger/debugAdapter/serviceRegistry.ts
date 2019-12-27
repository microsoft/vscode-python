// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Container } from 'inversify';
import { SocketServer } from '../../common/net/socket/socketServer';
import { FileSystem } from '../../common/platform/fileSystem';
import { PlatformService } from '../../common/platform/platformService';
import { IFileSystem, IPlatformService } from '../../common/platform/types';
import { CurrentProcess } from '../../common/process/currentProcess';
import { BufferDecoder } from '../../common/process/decoder';
import { IBufferDecoder, IProcessServiceFactory } from '../../common/process/types';
import { ICurrentProcess, IDisposableRegistry, ISocketServer } from '../../common/types';
import { ServiceContainer } from '../../ioc/container';
import { ServiceManager } from '../../ioc/serviceManager';
import { IServiceContainer, IServiceManager } from '../../ioc/types';
import { DebugStreamProvider } from './Common/debugStreamProvider';
import { DebuggerProcessServiceFactory } from './Common/processServiceFactory';
import { ProtocolLogger } from './Common/protocolLogger';
import { ProtocolParser } from './Common/protocolParser';
import { ProtocolMessageWriter } from './Common/protocolWriter';
import { IDebugStreamProvider, IProtocolLogger, IProtocolMessageWriter, IProtocolParser } from './types';

export function initializeIoc(): IServiceContainer {
    const cont = new Container();
    const serviceManager = new ServiceManager(cont);
    const serviceContainer = new ServiceContainer(cont);
    serviceManager.addSingletonInstance<IServiceContainer>(IServiceContainer, serviceContainer);
    registerTypes(serviceManager);
    return serviceContainer;
}

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<ICurrentProcess>(ICurrentProcess, CurrentProcess);
    serviceManager.addSingletonInstance<IDisposableRegistry>(IDisposableRegistry, []);
    serviceManager.addSingleton<IDebugStreamProvider>(IDebugStreamProvider, DebugStreamProvider);
    serviceManager.addSingleton<IProtocolLogger>(IProtocolLogger, ProtocolLogger);
    serviceManager.add<IProtocolParser>(IProtocolParser, ProtocolParser);
    serviceManager.addSingleton<IFileSystem>(IFileSystem, FileSystem);
    serviceManager.addSingleton<IPlatformService>(IPlatformService, PlatformService);
    serviceManager.addSingleton<ISocketServer>(ISocketServer, SocketServer);
    serviceManager.addSingleton<IProtocolMessageWriter>(IProtocolMessageWriter, ProtocolMessageWriter);
    serviceManager.addSingleton<IBufferDecoder>(IBufferDecoder, BufferDecoder);
    serviceManager.addSingleton<IProcessServiceFactory>(IProcessServiceFactory, DebuggerProcessServiceFactory);
}
