// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { IApplicationShell } from '../../../../client/common/application/types';
import { IInstaller, InstallerResponse, Product } from '../../../../client/common/types';
import { Common } from '../../../../client/common/utils/localize';
import { KernelDependencyService } from '../../../../client/datascience/jupyter/kernels/kernelDependencyService';
import { KernelInterpreterDependencyResponse } from '../../../../client/datascience/types';
import { createPythonInterpreter } from '../../../utils/interpreters';

// tslint:disable: no-any

// tslint:disable-next-line: max-func-body-length
suite('Data Science - Kernel Dependency Service', () => {
    let dependencyService: KernelDependencyService;
    let appShell: IApplicationShell;
    let installer: IInstaller;
    const interpreter = createPythonInterpreter();
    setup(() => {
        appShell = mock<IApplicationShell>();
        installer = mock<IInstaller>();
        dependencyService = new KernelDependencyService(instance(appShell), instance(installer));
    });
    test('Check if ipykernel is installed', async () => {
        when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(true);

        const response = await dependencyService.installMissingDependencies(interpreter);

        assert.equal(response, KernelInterpreterDependencyResponse.ok);
        verify(installer.isInstalled(Product.ipykernel, interpreter)).once();
        verify(installer.isInstalled(anything(), anything())).once();
    });
    test('Do not prompt if if ipykernel is installed', async () => {
        when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(true);

        const response = await dependencyService.installMissingDependencies(interpreter);

        assert.equal(response, KernelInterpreterDependencyResponse.ok);
        verify(appShell.showErrorMessage(anything(), anything(), anything())).never();
    });
    test('Prompt if if ipykernel is not installed', async () => {
        when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(false);
        when(appShell.showErrorMessage(anything(), anything(), anything())).thenResolve();

        const response = await dependencyService.installMissingDependencies(interpreter);

        assert.equal(response, KernelInterpreterDependencyResponse.cancel);
        verify(appShell.showErrorMessage(anything(), anything(), anything())).once();
    });
    test('Install ipykernel', async () => {
        when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(false);
        when(installer.install(Product.ipykernel, interpreter, anything())).thenResolve(InstallerResponse.Installed);
        when(appShell.showErrorMessage(anything(), anything(), anything())).thenResolve(Common.ok() as any);

        const response = await dependencyService.installMissingDependencies(interpreter);

        assert.equal(response, KernelInterpreterDependencyResponse.ok);
    });
    test('Bubble installation errors', async () => {
        when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(false);
        when(installer.install(Product.ipykernel, interpreter, anything())).thenReject(
            new Error('Install failed - kaboom')
        );
        when(appShell.showErrorMessage(anything(), anything(), anything())).thenResolve(Common.ok() as any);

        const promise = dependencyService.installMissingDependencies(interpreter);

        await assert.isRejected(promise, 'Install failed - kaboom');
    });
});
