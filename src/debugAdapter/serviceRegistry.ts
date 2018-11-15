// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Container } from 'inversify';
import { SocketServer } from '../client/common/net/socket/socketServer';
import { FileSystem } from '../client/common/platform/fileSystem';
import { PlatformService } from '../client/common/platform/platformService';
import { IFileSystem, IPlatformService } from '../client/common/platform/types';
import { CurrentProcess } from '../client/common/process/currentProcess';
import { BufferDecoder } from '../client/common/process/decoder';
import { IBufferDecoder, IProcessServiceFactory } from '../client/common/process/types';
import { ICurrentProcess, ISocketServer } from '../client/common/types';
import { ServiceContainer } from '../client/ioc/container';
import { ServiceManager } from '../client/ioc/serviceManager';
import { IServiceContainer, IServiceManager } from '../client/ioc/types';
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

function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<ICurrentProcess>(ICurrentProcess, CurrentProcess);
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
