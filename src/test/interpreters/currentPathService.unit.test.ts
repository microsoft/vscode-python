// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any

import { expect } from 'chai';
import * as path from 'path';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IProcessService, IProcessServiceFactory } from '../../client/common/process/types';
import {
    IConfigurationService,
    IPersistentState,
    IPersistentStateFactory,
    IPythonSettings
} from '../../client/common/types';
import { OSType } from '../../client/common/utils/platform';
import { IInterpreterVersionService } from '../../client/interpreter/contracts';
import { InterpreterHelper } from '../../client/interpreter/helpers';
import { IPythonInPathCommandProvider } from '../../client/interpreter/locators/types';
import { IVirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs/types';
import { IServiceContainer } from '../../client/ioc/types';
import {
    CurrentPathService,
    PythonInPathCommandProvider
} from '../../client/pythonEnvironments/discovery/locators/services/currentPathService';
import { InterpreterType, PythonInterpreter } from '../../client/pythonEnvironments/discovery/types';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../constants';

const isolated = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'pythonFiles', 'pyvsc-run-isolated.py');

suite('Interpreters CurrentPath Service', () => {
    let processService: TypeMoq.IMock<IProcessService>;
    let fileSystem: TypeMoq.IMock<IFileSystem>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let virtualEnvironmentManager: TypeMoq.IMock<IVirtualEnvironmentManager>;
    let interpreterHelper: TypeMoq.IMock<InterpreterHelper>;
    let pythonSettings: TypeMoq.IMock<IPythonSettings>;
    let currentPathService: CurrentPathService;
    let persistentState: TypeMoq.IMock<IPersistentState<PythonInterpreter[]>>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let pythonInPathCommandProvider: IPythonInPathCommandProvider;
    setup(async () => {
        processService = TypeMoq.Mock.ofType<IProcessService>();
        virtualEnvironmentManager = TypeMoq.Mock.ofType<IVirtualEnvironmentManager>();
        interpreterHelper = TypeMoq.Mock.ofType<InterpreterHelper>();
        const configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        configurationService.setup((c) => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        const persistentStateFactory = TypeMoq.Mock.ofType<IPersistentStateFactory>();
        persistentState = TypeMoq.Mock.ofType<IPersistentState<PythonInterpreter[]>>();
        processService.setup((x: any) => x.then).returns(() => undefined);
        persistentState.setup((p) => p.value).returns(() => undefined as any);
        persistentState.setup((p) => p.updateValue(TypeMoq.It.isAny())).returns(() => Promise.resolve());
        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => persistentState.object);
        const procServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
        procServiceFactory
            .setup((p) => p.create(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(processService.object));

        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IVirtualEnvironmentManager), TypeMoq.It.isAny()))
            .returns(() => virtualEnvironmentManager.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterVersionService), TypeMoq.It.isAny()))
            .returns(() => interpreterHelper.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IFileSystem), TypeMoq.It.isAny()))
            .returns(() => fileSystem.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IPersistentStateFactory), TypeMoq.It.isAny()))
            .returns(() => persistentStateFactory.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IConfigurationService), TypeMoq.It.isAny()))
            .returns(() => configurationService.object);
        pythonInPathCommandProvider = new PythonInPathCommandProvider(platformService.object);
        currentPathService = new CurrentPathService(
            interpreterHelper.object,
            procServiceFactory.object,
            pythonInPathCommandProvider,
            serviceContainer.object
        );
    });

    [true, false].forEach((isWindows) => {
        test(`Interpreters that do not exist on the file system are not excluded from the list (${
            isWindows ? 'windows' : 'not windows'
        })`, async () => {
            // Specific test for 1305
            const version = new SemVer('1.0.0');
            platformService.setup((p) => p.isWindows).returns(() => isWindows);
            platformService.setup((p) => p.osType).returns(() => (isWindows ? OSType.Windows : OSType.Linux));
            interpreterHelper
                .setup((v) => v.getInterpreterInformation(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve({ version }));

            const execArgs = [isolated, '-c', 'import sys;print(sys.executable)'];
            pythonSettings.setup((p) => p.pythonPath).returns(() => 'root:Python');
            processService
                .setup((p) =>
                    p.exec(TypeMoq.It.isValue('root:Python'), TypeMoq.It.isValue(execArgs), TypeMoq.It.isAny())
                )
                .returns(() => Promise.resolve({ stdout: 'c:/root:python' }))
                .verifiable(TypeMoq.Times.once());
            processService
                .setup((p) => p.exec(TypeMoq.It.isValue('python'), TypeMoq.It.isValue(execArgs), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve({ stdout: 'c:/python1' }))
                .verifiable(TypeMoq.Times.once());
            processService
                .setup((p) => p.exec(TypeMoq.It.isValue('python2'), TypeMoq.It.isValue(execArgs), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve({ stdout: 'c:/python2' }))
                .verifiable(TypeMoq.Times.once());
            processService
                .setup((p) => p.exec(TypeMoq.It.isValue('python3'), TypeMoq.It.isValue(execArgs), TypeMoq.It.isAny()))
                .returns(() => Promise.resolve({ stdout: 'c:/python3' }))
                .verifiable(TypeMoq.Times.once());

            fileSystem
                .setup((fs) => fs.fileExists(TypeMoq.It.isValue('c:/root:python')))
                .returns(() => Promise.resolve(true))
                .verifiable(TypeMoq.Times.once());
            fileSystem
                .setup((fs) => fs.fileExists(TypeMoq.It.isValue('c:/python1')))
                .returns(() => Promise.resolve(false))
                .verifiable(TypeMoq.Times.once());
            fileSystem
                .setup((fs) => fs.fileExists(TypeMoq.It.isValue('c:/python2')))
                .returns(() => Promise.resolve(false))
                .verifiable(TypeMoq.Times.once());
            fileSystem
                .setup((fs) => fs.fileExists(TypeMoq.It.isValue('c:/python3')))
                .returns(() => Promise.resolve(true))
                .verifiable(TypeMoq.Times.once());

            const interpreters = await currentPathService.getInterpreters();
            processService.verifyAll();
            fileSystem.verifyAll();

            expect(interpreters).to.be.of.length(2);
            expect(interpreters).to.deep.include({ version, path: 'c:/root:python', type: InterpreterType.Unknown });
            expect(interpreters).to.deep.include({ version, path: 'c:/python3', type: InterpreterType.Unknown });
        });
    });
});
