// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { IFileSystem } from '../../client/common/platform/types';
import { IProcessService } from '../../client/common/process/types';
import { IConfigurationService, IPersistentState, IPersistentStateFactory, IPythonSettings } from '../../client/common/types';
import { IInterpreterVersionService, InterpreterType, PythonInterpreter } from '../../client/interpreter/contracts';
import { CurrentPathService } from '../../client/interpreter/locators/services/currentPathService';
import { IVirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs/types';
import { IServiceContainer } from '../../client/ioc/types';

// tslint:disable-next-line:max-func-body-length
suite('Interpreters CurrentPath Service', () => {
    let processService: TypeMoq.IMock<IProcessService>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let virtualEnvironmentManager: TypeMoq.IMock<IVirtualEnvironmentManager>;
    let interpreterVersionService: TypeMoq.IMock<IInterpreterVersionService>;
    let pythonSettings: TypeMoq.IMock<IPythonSettings>;
    let currentPathService: CurrentPathService;
    let persistentState: TypeMoq.IMock<IPersistentState<PythonInterpreter[]>>;
    setup(async () => {
        processService = TypeMoq.Mock.ofType<IProcessService>();
        virtualEnvironmentManager = TypeMoq.Mock.ofType<IVirtualEnvironmentManager>();
        interpreterVersionService = TypeMoq.Mock.ofType<IInterpreterVersionService>();
        const configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        configurationService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        const persistentStateFactory = TypeMoq.Mock.ofType<IPersistentStateFactory>();
        persistentState = TypeMoq.Mock.ofType<IPersistentState<PythonInterpreter[]>>();
        // tslint:disable-next-line:no-any
        persistentState.setup(p => p.value).returns(() => undefined as any);
        persistentState.setup(p => p.updateValue(TypeMoq.It.isAny())).returns(() => Promise.resolve());
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        persistentStateFactory.setup(p => p.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => persistentState.object);

        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IProcessService), TypeMoq.It.isAny())).returns(() => processService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IVirtualEnvironmentManager), TypeMoq.It.isAny())).returns(() => virtualEnvironmentManager.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IInterpreterVersionService), TypeMoq.It.isAny())).returns(() => interpreterVersionService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IFileSystem), TypeMoq.It.isAny())).returns(() => fileSystem.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPersistentStateFactory), TypeMoq.It.isAny())).returns(() => persistentStateFactory.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService), TypeMoq.It.isAny())).returns(() => configurationService.object);

        currentPathService = new CurrentPathService(virtualEnvironmentManager.object, interpreterVersionService.object, processService.object, serviceContainer.object);
    });

    test('Interpreters that do not exist on the file system are not excluded from the list', async () => {
        // Specific test for 1305
        const version = 'mockVersion';
        const envName = 'mockEnvName';
        interpreterVersionService.setup(v => v.getVersion(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(version));
        virtualEnvironmentManager.setup(v => v.getEnvironmentName(TypeMoq.It.isAny())).returns(() => Promise.resolve(envName));

        const execArgs = ['-c', 'import sys;print(sys.executable)'];
        pythonSettings.setup(p => p.pythonPath).returns(() => 'root:Python');
        processService.setup(p => p.exec(TypeMoq.It.isValue('root:Python'), TypeMoq.It.isValue(execArgs), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'c:/root:python' })).verifiable(TypeMoq.Times.once());
        processService.setup(p => p.exec(TypeMoq.It.isValue('python'), TypeMoq.It.isValue(execArgs), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'c:/python1' })).verifiable(TypeMoq.Times.once());
        processService.setup(p => p.exec(TypeMoq.It.isValue('python2'), TypeMoq.It.isValue(execArgs), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'c:/python2' })).verifiable(TypeMoq.Times.once());
        processService.setup(p => p.exec(TypeMoq.It.isValue('python3'), TypeMoq.It.isValue(execArgs), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: 'c:/python3' })).verifiable(TypeMoq.Times.once());

        fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue('c:/root:python'))).returns(() => Promise.resolve(true)).verifiable(TypeMoq.Times.once());
        fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue('c:/python1'))).returns(() => Promise.resolve(false)).verifiable(TypeMoq.Times.once());
        fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue('c:/python2'))).returns(() => Promise.resolve(false)).verifiable(TypeMoq.Times.once());
        fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue('c:/python3'))).returns(() => Promise.resolve(true)).verifiable(TypeMoq.Times.once());

        const interpreters = await currentPathService.getInterpreters();
        processService.verifyAll();
        fileSystem.verifyAll();
        expect(interpreters).to.be.of.length(2);
        expect(interpreters).to.deep.include({ displayName: `${version} (${envName})`, path: 'c:/root:python', type: InterpreterType.VirtualEnv });
        expect(interpreters).to.deep.include({ displayName: `${version} (${envName})`, path: 'c:/python3', type: InterpreterType.VirtualEnv });
    });
});
