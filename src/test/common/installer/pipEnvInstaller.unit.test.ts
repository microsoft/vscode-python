// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Uri } from 'vscode';
import { DiscoveryVariants } from '../../../client/common/experiments/groups';
import { PipEnvInstaller } from '../../../client/common/installer/pipEnvInstaller';
import { IExperimentService } from '../../../client/common/types';
import { IComponentAdapter, IInterpreterLocatorService, PIPENV_SERVICE } from '../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../client/ioc/types';
import { EnvironmentType, PythonEnvironment } from '../../../client/pythonEnvironments/info';

suite('PipEnv installer', async () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let locatorService: TypeMoq.IMock<IInterpreterLocatorService>;
    let experimentService: TypeMoq.IMock<IExperimentService>;
    let componentAdapter: TypeMoq.IMock<IComponentAdapter>;
    let pipEnvInstaller: PipEnvInstaller;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        locatorService = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
        experimentService = TypeMoq.Mock.ofType<IExperimentService>();
        componentAdapter = TypeMoq.Mock.ofType<IComponentAdapter>();
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
            .setup((c) => c.get(TypeMoq.It.isValue(IComponentAdapter)))
            .returns(() => componentAdapter.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterLocatorService), TypeMoq.It.isValue(PIPENV_SERVICE)))
            .returns(() => locatorService.object);
        pipEnvInstaller = new PipEnvInstaller(serviceContainer.object);
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

    test('When in experiment, if InterpreterUri is Resource, and if resource contains pipEnv interpreters, return true', async () => {
        const resource = Uri.parse('a');
        experimentService.reset();
        experimentService
            .setup((e) => e.inExperiment(DiscoveryVariants.discoverWithFileWatching))
            .returns(() => Promise.resolve(true));
        componentAdapter
            .setup((p) => p.getInterpreters(resource))
            .returns(() =>
                Promise.resolve([{ envType: EnvironmentType.Conda }, { envType: EnvironmentType.Pipenv }] as any),
            );
        const result = await pipEnvInstaller.isSupported(resource);
        expect(result).to.equal(true, 'Should be true');
    });

    test('If InterpreterUri is Resource, and if resource does not contain pipEnv interpreters, return false', async () => {
        const resource = Uri.parse('a');
        locatorService.setup((p) => p.getInterpreters(resource)).returns(() => Promise.resolve([]));
        const result = await pipEnvInstaller.isSupported(resource);
        expect(result).to.equal(false, 'Should be false');
    });
});
