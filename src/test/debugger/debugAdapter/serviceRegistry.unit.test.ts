// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { anything, instance, mock, verify } from 'ts-mockito';
import { SocketServer } from '../../../client/common/net/socket/socketServer';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { PlatformService } from '../../../client/common/platform/platformService';
import { IFileSystem, IPlatformService } from '../../../client/common/platform/types';
import { CurrentProcess } from '../../../client/common/process/currentProcess';
import { BufferDecoder } from '../../../client/common/process/decoder';
import { IBufferDecoder, IProcessServiceFactory } from '../../../client/common/process/types';
import { ICurrentProcess, IDisposableRegistry, ISocketServer } from '../../../client/common/types';
import { DebugStreamProvider } from '../../../client/debugger/debugAdapter/Common/debugStreamProvider';
import { DebuggerProcessServiceFactory } from '../../../client/debugger/debugAdapter/Common/processServiceFactory';
import { ProtocolLogger } from '../../../client/debugger/debugAdapter/Common/protocolLogger';
import { ProtocolParser } from '../../../client/debugger/debugAdapter/Common/protocolParser';
import { ProtocolMessageWriter } from '../../../client/debugger/debugAdapter/Common/protocolWriter';
import { initializeIoc, registerTypes } from '../../../client/debugger/debugAdapter/serviceRegistry';
import { IDebugStreamProvider, IProtocolLogger, IProtocolMessageWriter, IProtocolParser } from '../../../client/debugger/debugAdapter/types';
import { ServiceContainer } from '../../../client/ioc/container';
import { ServiceManager } from '../../../client/ioc/serviceManager';
import { IServiceManager } from '../../../client/ioc/types';

suite('Debugger debug adapter Service Registry', () => {
    let serviceManager: IServiceManager;

    setup(() => {
        serviceManager = mock(ServiceManager);
    });

    test('Ensure services are registered', async () => {
        registerTypes(instance(serviceManager));
        verify(serviceManager.addSingleton<ICurrentProcess>(ICurrentProcess, CurrentProcess)).once();
        verify(serviceManager.addSingletonInstance<IDisposableRegistry>(IDisposableRegistry, anything())).once();
        verify(serviceManager.addSingleton<IDebugStreamProvider>(IDebugStreamProvider, DebugStreamProvider)).once();
        verify(serviceManager.addSingleton<IProtocolLogger>(IProtocolLogger, ProtocolLogger)).once();
        verify(serviceManager.add<IProtocolParser>(IProtocolParser, ProtocolParser)).once();
        verify(serviceManager.addSingleton<IFileSystem>(IFileSystem, FileSystem)).once();
        verify(serviceManager.addSingleton<IPlatformService>(IPlatformService, PlatformService)).once();
        verify(serviceManager.addSingleton<ISocketServer>(ISocketServer, SocketServer)).once();
        verify(serviceManager.addSingleton<IProtocolMessageWriter>(IProtocolMessageWriter, ProtocolMessageWriter)).once();
        verify(serviceManager.addSingleton<IBufferDecoder>(IBufferDecoder, BufferDecoder)).once();
        verify(serviceManager.addSingleton<IProcessServiceFactory>(IProcessServiceFactory, DebuggerProcessServiceFactory)).once();
    });

    test('Ensure service container is initialized', async () => {
        const serviceContainer = initializeIoc();
        expect(serviceContainer).to.be.instanceOf(ServiceContainer);
    });
});
