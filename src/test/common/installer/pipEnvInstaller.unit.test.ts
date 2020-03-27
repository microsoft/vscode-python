// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Uri } from 'vscode';
import { PipEnvInstaller } from '../../../client/common/installer/pipEnvInstaller';
import {
    IInterpreterLocatorService,
    InterpreterType,
    PIPENV_SERVICE,
    PythonInterpreter
} from '../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../client/ioc/types';

// tslint:disable-next-line: max-func-body-length
suite('PipEnv installer', async () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let locatorService: TypeMoq.IMock<IInterpreterLocatorService>;
    let pipEnvInstaller: PipEnvInstaller;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        locatorService = TypeMoq.Mock.ofType<IInterpreterLocatorService>();
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
            type: InterpreterType.Pipenv
        };
        // tslint:disable-next-line: no-any
        const result = await pipEnvInstaller.isSupported(interpreter as any);
        expect(result).to.equal(true, 'Should be true');
    });

    test('If InterpreterUri is Python interpreter but not of type Pipenv, method isSupported() returns false', async () => {
        const interpreter = {
            type: InterpreterType.Conda
        };
        // tslint:disable-next-line: no-any
        const result = await pipEnvInstaller.isSupported(interpreter as any);
        expect(result).to.equal(false, 'Should be false');
    });

    test('If InterpreterUri is Resource, and if resource contains pipEnv interpreters, return true', async () => {
        const resource = Uri.parse('a');
        locatorService
            .setup((p) => p.getInterpreters(resource))
            .returns(() =>
                Promise.resolve([
                    TypeMoq.Mock.ofType<PythonInterpreter>().object,
                    TypeMoq.Mock.ofType<PythonInterpreter>().object
                ])
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
