// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Uri, WorkspaceFolder } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../client/common/application/types';
import { EnumEx } from '../../client/common/enumUtils';
import { IFileSystem } from '../../client/common/platform/types';
import { IProcessService } from '../../client/common/process/types';
import { ICurrentProcess, IPersistentState, IPersistentStateFactory } from '../../client/common/types';
import { IEnvironmentVariablesProvider } from '../../client/common/variables/types';
import { IInterpreterLocatorService, IInterpreterVersionService } from '../../client/interpreter/contracts';
import { PipEnvService } from '../../client/interpreter/locators/services/pipEnvService';
import { IServiceContainer } from '../../client/ioc/types';

enum OS {
    Mac, Windows, Linux
}

suite('Interpreters - PipEnv', () => {
    const rootWorkspace = Uri.file(path.join('usr', 'desktop', 'wkspc1')).fsPath;
    EnumEx.getNamesAndValues(OS).forEach(os => {
        [undefined, Uri.file(path.join(rootWorkspace, 'one.py'))].forEach(resource => {
            const testSuffix = ` (${os.name}, ${resource ? 'with' : 'without'} a workspace)`;

            let pipEnvService: IInterpreterLocatorService;
            let serviceContainer: TypeMoq.IMock<IServiceContainer>;
            let interpreterVersionService: TypeMoq.IMock<IInterpreterVersionService>;
            let processService: TypeMoq.IMock<IProcessService>;
            let currentProcess: TypeMoq.IMock<ICurrentProcess>;
            let fileSystem: TypeMoq.IMock<IFileSystem>;
            let appShell: TypeMoq.IMock<IApplicationShell>;
            let persistentStateFactory: TypeMoq.IMock<IPersistentStateFactory>;
            let envVarsProvider: TypeMoq.IMock<IEnvironmentVariablesProvider>;
            setup(() => {
                serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
                const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
                interpreterVersionService = TypeMoq.Mock.ofType<IInterpreterVersionService>();
                fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
                processService = TypeMoq.Mock.ofType<IProcessService>();
                appShell = TypeMoq.Mock.ofType<IApplicationShell>();
                currentProcess = TypeMoq.Mock.ofType<ICurrentProcess>();
                persistentStateFactory = TypeMoq.Mock.ofType<IPersistentStateFactory>();
                envVarsProvider = TypeMoq.Mock.ofType<IEnvironmentVariablesProvider>();

                // tslint:disable-next-line:no-any
                const persistentState = TypeMoq.Mock.ofType<IPersistentState<any>>();
                persistentStateFactory.setup(p => p.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => persistentState.object);
                persistentStateFactory.setup(p => p.createWorkspacePersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => persistentState.object);
                persistentState.setup(p => p.value).returns(() => undefined);
                persistentState.setup(p => p.updateValue(TypeMoq.It.isAny())).returns(() => Promise.resolve());

                const workspaceFolder = TypeMoq.Mock.ofType<WorkspaceFolder>();
                workspaceFolder.setup(w => w.uri).returns(() => Uri.file(rootWorkspace));
                workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder.object);
                workspaceService.setup(w => w.rootPath).returns(() => rootWorkspace);

                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService))).returns(() => workspaceService.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IInterpreterVersionService))).returns(() => interpreterVersionService.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IProcessService))).returns(() => processService.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ICurrentProcess))).returns(() => currentProcess.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fileSystem.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IApplicationShell))).returns(() => appShell.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPersistentStateFactory))).returns(() => persistentStateFactory.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IEnvironmentVariablesProvider))).returns(() => envVarsProvider.object);

                pipEnvService = new PipEnvService(serviceContainer.object);
            });

            test(`Should return an empty list'${testSuffix}`, () => {
                const environments = pipEnvService.getInterpreters(resource);
                expect(environments).to.be.eventually.deep.equal([]);
            });
            test(`Should return an empty list if there is a \'PipFile\'${testSuffix}`, async () => {
                const env = {};
                envVarsProvider.setup(e => e.getEnvironmentVariables(TypeMoq.It.isAny())).returns(() => Promise.resolve({})).verifiable(TypeMoq.Times.once());
                currentProcess.setup(c => c.env).returns(() => env);
                fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile')))).returns(() => Promise.resolve(false)).verifiable(TypeMoq.Times.once());
                const environments = await pipEnvService.getInterpreters(resource);

                expect(environments).to.be.deep.equal([]);
                fileSystem.verifyAll();
            });
            test(`Should display warning message if there is a \'PipFile\' but \'pipenv --venv\' failes ${testSuffix}`, async () => {
                const env = {};
                currentProcess.setup(c => c.env).returns(() => env);
                processService.setup(p => p.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.reject(''));
                fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile')))).returns(() => Promise.resolve(true));
                appShell.setup(a => a.showWarningMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('')).verifiable(TypeMoq.Times.once());
                const environments = await pipEnvService.getInterpreters(resource);

                expect(environments).to.be.deep.equal([]);
                appShell.verifyAll();
                appShell.verifyAll();
            });
            test(`Should display warning message if there is a \'PipFile\' but \'pipenv --venv\' failes with stderr ${testSuffix}`, async () => {
                const env = {};
                envVarsProvider.setup(e => e.getEnvironmentVariables(TypeMoq.It.isAny())).returns(() => Promise.resolve({})).verifiable(TypeMoq.Times.once());
                currentProcess.setup(c => c.env).returns(() => env);
                processService.setup(p => p.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stderr: 'PipEnv Failed', stdout: '' }));
                fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile')))).returns(() => Promise.resolve(true));
                appShell.setup(a => a.showWarningMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('')).verifiable(TypeMoq.Times.once());
                const environments = await pipEnvService.getInterpreters(resource);

                expect(environments).to.be.deep.equal([]);
                envVarsProvider.verifyAll();
                appShell.verifyAll();
            });
            test(`Should return interpreter information${testSuffix}`, async () => {
                const env = {};
                const venvDir = 'one';
                envVarsProvider.setup(e => e.getEnvironmentVariables(TypeMoq.It.isAny())).returns(() => Promise.resolve({})).verifiable(TypeMoq.Times.once());
                currentProcess.setup(c => c.env).returns(() => env);
                processService.setup(p => p.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: venvDir }));
                interpreterVersionService.setup(v => v.getVersion(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('xyz'));
                fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile')))).returns(() => Promise.resolve(true)).verifiable();
                fileSystem.setup(fs => fs.directoryExistsAsync(TypeMoq.It.isValue(venvDir))).returns(() => Promise.resolve(true)).verifiable();
                const environments = await pipEnvService.getInterpreters(resource);

                expect(environments).to.be.lengthOf(1);
                fileSystem.verifyAll();
                envVarsProvider.verifyAll();
            });
            test(`Should return interpreter information using PipFile defined in Env variable${testSuffix}`, async () => {
                const envPipFile = 'XYZ';
                const env = {
                    PIPENV_PIPFILE: envPipFile
                };
                const venvDir = 'one';
                envVarsProvider.setup(e => e.getEnvironmentVariables(TypeMoq.It.isAny())).returns(() => Promise.resolve({})).verifiable(TypeMoq.Times.once());
                currentProcess.setup(c => c.env).returns(() => env);
                processService.setup(p => p.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: venvDir }));
                interpreterVersionService.setup(v => v.getVersion(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('xyz'));
                fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile')))).returns(() => Promise.resolve(false)).verifiable(TypeMoq.Times.never());
                fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(path.join(rootWorkspace, envPipFile)))).returns(() => Promise.resolve(true)).verifiable(TypeMoq.Times.once());
                fileSystem.setup(fs => fs.directoryExistsAsync(TypeMoq.It.isValue(venvDir))).returns(() => Promise.resolve(true)).verifiable();
                const environments = await pipEnvService.getInterpreters(resource);

                expect(environments).to.be.lengthOf(1);
                fileSystem.verifyAll();
                envVarsProvider.verifyAll();
            });
        });
    });
});
