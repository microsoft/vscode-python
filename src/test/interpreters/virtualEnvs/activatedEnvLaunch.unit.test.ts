// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Uri, WorkspaceFolder } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../../client/common/application/types';
import { IProcessServiceFactory } from '../../../client/common/process/types';
import { IPythonPathUpdaterServiceManager } from '../../../client/interpreter/configuration/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { ActivatedEnvironmentLaunch } from '../../../client/interpreter/virtualEnvs/activatedEnvLaunch';
import { PythonEnvironment } from '../../../client/pythonEnvironments/info';

suite('Activated Env Launch', async () => {
    const uri = Uri.file('a');
    const condaPrefix = 'path/to/conda/env';
    const virtualEnvPrefix = 'path/to/virtual/env';
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let pythonPathUpdaterService: TypeMoq.IMock<IPythonPathUpdaterServiceManager>;
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let processServiceFactory: TypeMoq.IMock<IProcessServiceFactory>;
    let activatedEnvLaunch: ActivatedEnvironmentLaunch;

    suite('Method getPrefixOfSelectedActivatedEnv()', () => {
        const oldCondaPrefix = process.env.CONDA_PREFIX;
        const oldCondaShlvl = process.env.CONDA_SHLVL;
        const oldVirtualEnv = process.env.VIRTUAL_ENV;
        setup(() => {
            workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
            pythonPathUpdaterService = TypeMoq.Mock.ofType<IPythonPathUpdaterServiceManager>();
            appShell = TypeMoq.Mock.ofType<IApplicationShell>();
            interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
            processServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
            sinon.stub(ActivatedEnvironmentLaunch.prototype, '_promptIfApplicable').returns(Promise.resolve());
        });

        teardown(() => {
            if (oldCondaPrefix) {
                process.env.CONDA_PREFIX = oldCondaPrefix;
            } else {
                delete process.env.CONDA_PREFIX;
            }
            if (oldCondaShlvl) {
                process.env.CONDA_SHLVL = oldCondaShlvl;
            } else {
                delete process.env.CONDA_SHLVL;
            }
            if (oldVirtualEnv) {
                process.env.VIRTUAL_ENV = oldVirtualEnv;
            } else {
                delete process.env.VIRTUAL_ENV;
            }
            sinon.restore();
        });

        test('Updates interpreter path with the non-base conda prefix if activated', async () => {
            process.env.CONDA_PREFIX = condaPrefix;
            process.env.CONDA_SHLVL = '1';
            interpreterService
                .setup((i) => i.getInterpreterDetails(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(({ envName: 'env' } as unknown) as PythonEnvironment));
            workspaceService.setup((w) => w.workspaceFile).returns(() => undefined);
            const workspaceFolder: WorkspaceFolder = { name: 'one', uri, index: 0 };
            workspaceService.setup((w) => w.workspaceFolders).returns(() => [workspaceFolder]);
            pythonPathUpdaterService
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(condaPrefix),
                        TypeMoq.It.isValue(ConfigurationTarget.WorkspaceFolder),
                        TypeMoq.It.isValue('load'),
                        TypeMoq.It.isValue(uri),
                    ),
                )
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());
            activatedEnvLaunch = new ActivatedEnvironmentLaunch(
                workspaceService.object,
                appShell.object,
                pythonPathUpdaterService.object,
                interpreterService.object,
                processServiceFactory.object,
            );
            const result = await activatedEnvLaunch.selectIfLaunchedViaActivatedEnv();
            expect(result).to.be.equal(condaPrefix, 'Incorrect value');
            pythonPathUpdaterService.verifyAll();
        });

        test('Updates interpreter path with the base conda prefix if activated and environment var is configured to not auto activate it', async () => {
            process.env.CONDA_PREFIX = condaPrefix;
            process.env.CONDA_SHLVL = '1';
            process.env.CONDA_AUTO_ACTIVATE_BASE = 'false';
            interpreterService
                .setup((i) => i.getInterpreterDetails(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(({ envName: 'base' } as unknown) as PythonEnvironment));
            workspaceService.setup((w) => w.workspaceFile).returns(() => undefined);
            const workspaceFolder: WorkspaceFolder = { name: 'one', uri, index: 0 };
            workspaceService.setup((w) => w.workspaceFolders).returns(() => [workspaceFolder]);
            pythonPathUpdaterService
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(condaPrefix),
                        TypeMoq.It.isValue(ConfigurationTarget.WorkspaceFolder),
                        TypeMoq.It.isValue('load'),
                        TypeMoq.It.isValue(uri),
                    ),
                )
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());
            activatedEnvLaunch = new ActivatedEnvironmentLaunch(
                workspaceService.object,
                appShell.object,
                pythonPathUpdaterService.object,
                interpreterService.object,
                processServiceFactory.object,
            );
            const result = await activatedEnvLaunch.selectIfLaunchedViaActivatedEnv();
            expect(result).to.be.equal(condaPrefix, 'Incorrect value');
            pythonPathUpdaterService.verifyAll();
        });

        test('Updates interpreter path with the base conda prefix if activated and environment var is configured to auto activate it', async () => {
            process.env.CONDA_PREFIX = condaPrefix;
            process.env.CONDA_SHLVL = '1';
            process.env.CONDA_AUTO_ACTIVATE_BASE = 'true';
            interpreterService
                .setup((i) => i.getInterpreterDetails(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(({ envName: 'base' } as unknown) as PythonEnvironment));
            workspaceService.setup((w) => w.workspaceFile).returns(() => undefined);
            const workspaceFolder: WorkspaceFolder = { name: 'one', uri, index: 0 };
            workspaceService.setup((w) => w.workspaceFolders).returns(() => [workspaceFolder]);
            pythonPathUpdaterService
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(condaPrefix),
                        TypeMoq.It.isValue(ConfigurationTarget.WorkspaceFolder),
                        TypeMoq.It.isValue('load'),
                        TypeMoq.It.isValue(uri),
                    ),
                )
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.never());
            activatedEnvLaunch = new ActivatedEnvironmentLaunch(
                workspaceService.object,
                appShell.object,
                pythonPathUpdaterService.object,
                interpreterService.object,
                processServiceFactory.object,
            );
            const result = await activatedEnvLaunch.selectIfLaunchedViaActivatedEnv();
            expect(result).to.be.equal(undefined, 'Incorrect value');
            pythonPathUpdaterService.verifyAll();
        });

        test('Updates interpreter path with virtual env prefix if activated', async () => {
            process.env.VIRTUAL_ENV = virtualEnvPrefix;
            interpreterService
                .setup((i) => i.getInterpreterDetails(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(({ envName: 'base' } as unknown) as PythonEnvironment));
            workspaceService.setup((w) => w.workspaceFile).returns(() => undefined);
            const workspaceFolder: WorkspaceFolder = { name: 'one', uri, index: 0 };
            workspaceService.setup((w) => w.workspaceFolders).returns(() => [workspaceFolder]);
            pythonPathUpdaterService
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(virtualEnvPrefix),
                        TypeMoq.It.isValue(ConfigurationTarget.WorkspaceFolder),
                        TypeMoq.It.isValue('load'),
                        TypeMoq.It.isValue(uri),
                    ),
                )
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());
            activatedEnvLaunch = new ActivatedEnvironmentLaunch(
                workspaceService.object,
                appShell.object,
                pythonPathUpdaterService.object,
                interpreterService.object,
                processServiceFactory.object,
            );
            const result = await activatedEnvLaunch.selectIfLaunchedViaActivatedEnv();
            expect(result).to.be.equal(virtualEnvPrefix, 'Incorrect value');
            pythonPathUpdaterService.verifyAll();
        });

        test('Updates interpreter path in global scope if no workspace is opened', async () => {
            process.env.CONDA_PREFIX = condaPrefix;
            process.env.CONDA_SHLVL = '1';
            interpreterService
                .setup((i) => i.getInterpreterDetails(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(({ envName: 'env' } as unknown) as PythonEnvironment));
            workspaceService.setup((w) => w.workspaceFile).returns(() => undefined);
            workspaceService.setup((w) => w.workspaceFolders).returns(() => []);
            pythonPathUpdaterService
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(condaPrefix),
                        TypeMoq.It.isValue(ConfigurationTarget.Global),
                        TypeMoq.It.isValue('load'),
                    ),
                )
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());
            activatedEnvLaunch = new ActivatedEnvironmentLaunch(
                workspaceService.object,
                appShell.object,
                pythonPathUpdaterService.object,
                interpreterService.object,
                processServiceFactory.object,
            );
            const result = await activatedEnvLaunch.selectIfLaunchedViaActivatedEnv();
            expect(result).to.be.equal(condaPrefix, 'Incorrect value');
            pythonPathUpdaterService.verifyAll();
        });

        test('Does not update interpreter path if a multiroot workspace is opened', async () => {
            process.env.VIRTUAL_ENV = virtualEnvPrefix;
            interpreterService
                .setup((i) => i.getInterpreterDetails(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(({ envName: 'base' } as unknown) as PythonEnvironment));
            workspaceService.setup((w) => w.workspaceFile).returns(() => uri);
            const workspaceFolder: WorkspaceFolder = { name: 'one', uri, index: 0 };
            workspaceService.setup((w) => w.workspaceFolders).returns(() => [workspaceFolder]);
            pythonPathUpdaterService
                .setup((p) =>
                    p.updatePythonPath(
                        TypeMoq.It.isValue(virtualEnvPrefix),
                        TypeMoq.It.isValue(ConfigurationTarget.WorkspaceFolder),
                        TypeMoq.It.isValue('load'),
                        TypeMoq.It.isValue(uri),
                    ),
                )
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.never());
            activatedEnvLaunch = new ActivatedEnvironmentLaunch(
                workspaceService.object,
                appShell.object,
                pythonPathUpdaterService.object,
                interpreterService.object,
                processServiceFactory.object,
            );
            const result = await activatedEnvLaunch.selectIfLaunchedViaActivatedEnv();
            expect(result).to.be.equal(undefined, 'Incorrect value');
            pythonPathUpdaterService.verifyAll();
        });

        test('Returns `undefined` if env was already selected', async () => {
            activatedEnvLaunch = new ActivatedEnvironmentLaunch(
                workspaceService.object,
                appShell.object,
                pythonPathUpdaterService.object,
                interpreterService.object,
                processServiceFactory.object,
                true,
            );
            const result = await activatedEnvLaunch.selectIfLaunchedViaActivatedEnv();
            expect(result).to.be.equal(undefined, 'Incorrect value');
        });
    });
});
