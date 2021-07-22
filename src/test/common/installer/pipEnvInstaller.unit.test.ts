// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { DiscoveryVariants } from '../../../client/common/experiments/groups';
import { PipEnvInstaller } from '../../../client/common/installer/pipEnvInstaller';
import { IExperimentService } from '../../../client/common/types';
import { IInterpreterLocatorService, IInterpreterService, PIPENV_SERVICE } from '../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../client/ioc/types';
import * as pipEnvHelper from '../../../client/pythonEnvironments/common/environmentManagers/pipenv';
import { EnvironmentType, PythonEnvironment } from '../../../client/pythonEnvironments/info';

suite('PipEnv installer', async () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let locatorService: TypeMoq.IMock<IInterpreterLocatorService>;
    let experimentService: TypeMoq.IMock<IExperimentService>;
    let isPipenvEnvironmentRelatedToFolder: sinon.SinonStub;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let pipEnvInstaller: PipEnvInstaller;
    const interpreterPath = 'path/to/interpreter';
    const workspaceFolder = 'path/to/folder';
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        locatorService = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
        experimentService = TypeMoq.Mock.ofType<IExperimentService>();
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterLocatorService), TypeMoq.It.isValue(PIPENV_SERVICE)))
            .returns(() => locatorService.object);
        experimentService
            .setup((e) => e.inExperiment(DiscoveryVariants.discoverWithFileWatching))
            .returns(() => Promise.resolve(false));
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IExperimentService)))
            .returns(() => experimentService.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterLocatorService), TypeMoq.It.isValue(PIPENV_SERVICE)))
            .returns(() => locatorService.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IWorkspaceService)))
            .returns(() => workspaceService.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterService)))
            .returns(() => interpreterService.object);

        isPipenvEnvironmentRelatedToFolder = sinon
            .stub(pipEnvHelper, 'isPipenvEnvironmentRelatedToFolder')
            .callsFake((interpreter: string, folder: string) => {
                return Promise.resolve(interpreterPath === interpreter && folder === workspaceFolder);
            });
        pipEnvInstaller = new PipEnvInstaller(serviceContainer.object);
    });

    teardown(() => {
        isPipenvEnvironmentRelatedToFolder.restore();
    });

    test('Installer name is pipenv', () => {
        expect(pipEnvInstaller.name).to.equal('pipenv');
    });

    test('Installer priority is 10', () => {
        expect(pipEnvInstaller.priority).to.equal(10);
    });

    test('If InterpreterUri is Pipenv interpreter, method isSupported() returns true', async () => {
        const interpreter = {
            envType: EnvironmentType.Pipenv,
        };

        const result = await pipEnvInstaller.isSupported(interpreter as any);
        expect(result).to.equal(true, 'Should be true');
    });

    test('If InterpreterUri is Python interpreter but not of type Pipenv, method isSupported() returns false', async () => {
        const interpreter = {
            envType: EnvironmentType.Conda,
        };

        const result = await pipEnvInstaller.isSupported(interpreter as any);
        expect(result).to.equal(false, 'Should be false');
    });

    test('If InterpreterUri is Resource, and if resource contains pipEnv interpreters, return true', async () => {
        const resource = Uri.parse('a');
        locatorService
            .setup((p) => p.getInterpreters(resource))
            .returns(() =>
                Promise.resolve([
                    TypeMoq.Mock.ofType<PythonEnvironment>().object,
                    TypeMoq.Mock.ofType<PythonEnvironment>().object,
                ]),
            );
        const result = await pipEnvInstaller.isSupported(resource);
        expect(result).to.equal(true, 'Should be true');
    });

    test('When in experiment, if active environment is pipenv and is related to workspace folder, return true', async () => {
        const resource = Uri.parse('a');
        experimentService.reset();
        experimentService
            .setup((e) => e.inExperiment(DiscoveryVariants.discoverWithFileWatching))
            .returns(() => Promise.resolve(true));
        interpreterService
            .setup((p) => p.getActiveInterpreter(resource))
            .returns(() => Promise.resolve({ envType: EnvironmentType.Pipenv, path: interpreterPath } as any));

        workspaceService
            .setup((w) => w.getWorkspaceFolder(resource))
            .returns(() => ({ uri: { fsPath: workspaceFolder } } as any));
        const result = await pipEnvInstaller.isSupported(resource);
        expect(result).to.equal(true, 'Should be true');
    });

    test('When in experiment, if active environment is not pipenv, return false', async () => {
        const resource = Uri.parse('a');
        experimentService.reset();
        experimentService
            .setup((e) => e.inExperiment(DiscoveryVariants.discoverWithFileWatching))
            .returns(() => Promise.resolve(true));
        interpreterService
            .setup((p) => p.getActiveInterpreter(resource))
            .returns(() => Promise.resolve({ envType: EnvironmentType.Conda, path: interpreterPath } as any));

        workspaceService
            .setup((w) => w.getWorkspaceFolder(resource))
            .returns(() => ({ uri: { fsPath: workspaceFolder } } as any));
        const result = await pipEnvInstaller.isSupported(resource);
        expect(result).to.equal(false, 'Should be false');
    });

    test('When in experiment, if active environment is pipenv but not related to workspace folder, return false', async () => {
        const resource = Uri.parse('a');
        experimentService.reset();
        experimentService
            .setup((e) => e.inExperiment(DiscoveryVariants.discoverWithFileWatching))
            .returns(() => Promise.resolve(true));
        interpreterService
            .setup((p) => p.getActiveInterpreter(resource))
            .returns(() => Promise.resolve({ envType: EnvironmentType.Pipenv, path: 'some random path' } as any));

        workspaceService
            .setup((w) => w.getWorkspaceFolder(resource))
            .returns(() => ({ uri: { fsPath: workspaceFolder } } as any));
        const result = await pipEnvInstaller.isSupported(resource);
        expect(result).to.equal(false, 'Should be false');
    });

    test('If InterpreterUri is Resource, and if resource does not contain pipEnv interpreters, return false', async () => {
        const resource = Uri.parse('a');
        locatorService.setup((p) => p.getInterpreters(resource)).returns(() => Promise.resolve([]));
        const result = await pipEnvInstaller.isSupported(resource);
        expect(result).to.equal(false, 'Should be false');
    });
});
