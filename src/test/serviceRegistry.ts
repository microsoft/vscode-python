// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Container } from 'inversify';
import { anything, instance, mock, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { Disposable, Memento, OutputChannel } from 'vscode';
import { STANDARD_OUTPUT_CHANNEL } from '../client/common/constants';
import { Logger } from '../client/common/logger';
import { IS_WINDOWS } from '../client/common/platform/constants';
import { FileSystem } from '../client/common/platform/fileSystem';
import { PathUtils } from '../client/common/platform/pathUtils';
import { PlatformService } from '../client/common/platform/platformService';
import { registerTypes as platformRegisterTypes } from '../client/common/platform/serviceRegistry';
import { IFileSystem, IPlatformService } from '../client/common/platform/types';
import { BufferDecoder } from '../client/common/process/decoder';
import { ProcessService } from '../client/common/process/proc';
import { PythonExecutionFactory } from '../client/common/process/pythonExecutionFactory';
import { PythonToolExecutionService } from '../client/common/process/pythonToolService';
import { registerTypes as processRegisterTypes } from '../client/common/process/serviceRegistry';
import { IBufferDecoder, IProcessServiceFactory, IPythonExecutionFactory, IPythonToolExecutionService } from '../client/common/process/types';
import { registerTypes as commonRegisterTypes } from '../client/common/serviceRegistry';
import { GLOBAL_MEMENTO, ICurrentProcess, IDisposableRegistry, ILogger, IMemento, IOutputChannel, IPathUtils, IsWindows, WORKSPACE_MEMENTO } from '../client/common/types';
import { registerTypes as variableRegisterTypes } from '../client/common/variables/serviceRegistry';
import { registerTypes as formattersRegisterTypes } from '../client/formatters/serviceRegistry';
import { EnvironmentActivationService } from '../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../client/interpreter/activation/types';
import { IInterpreterAutoSelectionService, IInterpreterAutoSeletionProxyService } from '../client/interpreter/autoSelection/types';
import { registerTypes as interpretersRegisterTypes } from '../client/interpreter/serviceRegistry';
import { ServiceContainer } from '../client/ioc/container';
import { ServiceManager } from '../client/ioc/serviceManager';
import { IServiceContainer, IServiceManager } from '../client/ioc/types';
import { registerTypes as lintersRegisterTypes } from '../client/linters/serviceRegistry';
import { TEST_OUTPUT_CHANNEL } from '../client/unittests/common/constants';
import { registerTypes as unittestsRegisterTypes } from '../client/unittests/serviceRegistry';
import { MockOutputChannel } from './mockClasses';
import { MockAutoSelectionService } from './mocks/autoSelector';
import { MockMemento } from './mocks/mementos';
import { MockProcessService } from './mocks/proc';
import { MockProcess } from './mocks/process';

export class IocContainer {
    public readonly serviceManager: IServiceManager;
    public readonly serviceContainer: IServiceContainer;

    private disposables: Disposable[] = [];

    constructor() {
        const cont = new Container();
        this.serviceManager = new ServiceManager(cont);
        this.serviceContainer = new ServiceContainer(cont);

        this.serviceManager.addSingletonInstance<IServiceContainer>(IServiceContainer, this.serviceContainer);
        this.serviceManager.addSingletonInstance<Disposable[]>(IDisposableRegistry, this.disposables);
        this.serviceManager.addSingleton<Memento>(IMemento, MockMemento, GLOBAL_MEMENTO);
        this.serviceManager.addSingleton<Memento>(IMemento, MockMemento, WORKSPACE_MEMENTO);

        const stdOutputChannel = new MockOutputChannel('Python');
        this.disposables.push(stdOutputChannel);
        this.serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, stdOutputChannel, STANDARD_OUTPUT_CHANNEL);
        const testOutputChannel = new MockOutputChannel('Python Test - UnitTests');
        this.disposables.push(testOutputChannel);
        this.serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, testOutputChannel, TEST_OUTPUT_CHANNEL);

        this.serviceManager.addSingleton<IInterpreterAutoSelectionService>(IInterpreterAutoSelectionService, MockAutoSelectionService);
        this.serviceManager.addSingleton<IInterpreterAutoSeletionProxyService>(IInterpreterAutoSeletionProxyService, MockAutoSelectionService);
    }
    public async dispose() : Promise<void> {
        for (const disposable of this.disposables) {
            if (!disposable) {
                continue;
            }
            // tslint:disable-next-line:no-any
            const promise = disposable.dispose() as Promise<any>;
            if (promise) {
                await promise;
            }
        }
    }

    public registerCommonTypes(registerFileSystem: boolean = true) {
        commonRegisterTypes(this.serviceManager);
        if (registerFileSystem) {
            this.registerFileSystemTypes();
        }
    }
    public registerFileSystemTypes() {
        this.serviceManager.addSingleton<IPlatformService>(IPlatformService, PlatformService);
        this.serviceManager.addSingleton<IFileSystem>(IFileSystem, FileSystem);
    }
    public registerProcessTypes() {
        processRegisterTypes(this.serviceManager);
        const mockEnvironmentActivationService = mock(EnvironmentActivationService);
        when(mockEnvironmentActivationService.getActivatedEnvironmentVariables(anything())).thenResolve();
        this.serviceManager.addSingletonInstance<IEnvironmentActivationService>(IEnvironmentActivationService, instance(mockEnvironmentActivationService));
    }
    public registerVariableTypes() {
        variableRegisterTypes(this.serviceManager);
    }
    public registerUnitTestTypes() {
        unittestsRegisterTypes(this.serviceManager);
    }
    public registerLinterTypes() {
        lintersRegisterTypes(this.serviceManager);
    }
    public registerFormatterTypes() {
        formattersRegisterTypes(this.serviceManager);
    }
    public registerPlatformTypes() {
        platformRegisterTypes(this.serviceManager);
    }
    public registerInterpreterTypes() {
        interpretersRegisterTypes(this.serviceManager);
    }
    public registerMockProcessTypes() {
        this.serviceManager.addSingleton<IBufferDecoder>(IBufferDecoder, BufferDecoder);
        const processServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
        // tslint:disable-next-line:no-any
        const processService = new MockProcessService(new ProcessService(new BufferDecoder(), process.env as any));
        processServiceFactory.setup(f => f.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(processService));
        this.serviceManager.addSingletonInstance<IProcessServiceFactory>(IProcessServiceFactory, processServiceFactory.object);
        this.serviceManager.addSingleton<IPythonExecutionFactory>(IPythonExecutionFactory, PythonExecutionFactory);
        this.serviceManager.addSingleton<IPythonToolExecutionService>(IPythonToolExecutionService, PythonToolExecutionService);
        this.serviceManager.addSingleton<IEnvironmentActivationService>(IEnvironmentActivationService, EnvironmentActivationService);
        const mockEnvironmentActivationService = mock(EnvironmentActivationService);
        when(mockEnvironmentActivationService.getActivatedEnvironmentVariables(anything())).thenResolve();
        this.serviceManager.rebindInstance<IEnvironmentActivationService>(IEnvironmentActivationService, instance(mockEnvironmentActivationService));
    }

    public registerMockProcess() {
        this.serviceManager.addSingletonInstance<boolean>(IsWindows, IS_WINDOWS);

        this.serviceManager.addSingleton<ILogger>(ILogger, Logger);
        this.serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);
        this.serviceManager.addSingleton<ICurrentProcess>(ICurrentProcess, MockProcess);
    }
}
