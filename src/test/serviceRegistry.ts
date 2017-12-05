// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Container } from 'inversify';
import 'reflect-metadata';
import { Disposable, Memento, OutputChannel } from 'vscode';
import { BufferDecoder } from '../client/common/process/decoder';
import { ProcessService } from '../client/common/process/proc';
import { PythonExecutionFactory } from '../client/common/process/pythonExecutionFactory';
import { registerTypes as processRegisterTypes } from '../client/common/process/serviceRegistry';
import { IBufferDecoder, IProcessService, IPythonExecutionFactory } from '../client/common/process/types';
import { registerTypes as commonRegisterTypes } from '../client/common/serviceRegistry';
import { GLOBAL_MEMENTO, IDiposableRegistry, IMemento, IOutputChannel, WORKSPACE_MEMENTO } from '../client/common/types';
import { registerTypes as variableRegisterTypes } from '../client/common/variables/serviceRegistry';
import { ServiceContainer } from '../client/ioc/container';
import { ServiceManager } from '../client/ioc/serviceManager';
import { IServiceContainer, IServiceManager } from '../client/ioc/types';
import { TEST_OUTPUT_CHANNEL } from '../client/unittests/common/constants';
import { registerTypes as unittestsRegisterTypes } from '../client/unittests/serviceRegistry';
import { MockOutputChannel } from './mockClasses';
import { MockMemento } from './mocks/mementos';
import { IOriginalProcessService, MockProcessService } from './mocks/proc';

export class IocContainer {
    public readonly serviceManager: IServiceManager;
    public readonly serviceContainer: IServiceContainer;

    private disposables: Disposable[] = [];

    constructor() {
        const cont = new Container();
        this.serviceManager = new ServiceManager(cont);
        this.serviceContainer = new ServiceContainer(cont);

        this.serviceManager.addSingletonInstance<IServiceContainer>(IServiceContainer, this.serviceContainer);
        this.serviceManager.addSingletonInstance<Disposable[]>(IDiposableRegistry, this.disposables);
        this.serviceManager.addSingleton<Memento>(IMemento, MockMemento, GLOBAL_MEMENTO);
        this.serviceManager.addSingleton<Memento>(IMemento, MockMemento, WORKSPACE_MEMENTO);

        this.serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, new MockOutputChannel('Python Test - UnitTests'), TEST_OUTPUT_CHANNEL);
    }

    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }

    public registerCommonTypes() {
        commonRegisterTypes(this.serviceManager);
    }
    public registerProcessTypes() {
        processRegisterTypes(this.serviceManager);
    }
    public registerVariableTypes() {
        variableRegisterTypes(this.serviceManager);
    }
    public registerUnitTestTypes() {
        unittestsRegisterTypes(this.serviceManager);
    }

    public registerMockProcessTypes() {
        this.serviceManager.addSingleton<IBufferDecoder>(IBufferDecoder, BufferDecoder);
        this.serviceManager.addSingleton<IProcessService>(IOriginalProcessService, ProcessService);
        this.serviceManager.addSingleton<IProcessService>(IProcessService, MockProcessService);
        this.serviceManager.addSingleton<IPythonExecutionFactory>(IPythonExecutionFactory, PythonExecutionFactory);
    }
}
