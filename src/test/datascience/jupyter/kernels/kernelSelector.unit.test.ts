// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { IApplicationShell } from '../../../../client/common/application/types';
import { PYTHON_LANGUAGE } from '../../../../client/common/constants';
import { ProductInstaller } from '../../../../client/common/installer/productInstaller';
import { IInstaller, InstallerResponse, Product } from '../../../../client/common/types';
import { noop } from '../../../../client/common/utils/misc';
import { Architecture } from '../../../../client/common/utils/platform';
import { JupyterSessionManager } from '../../../../client/datascience/jupyter/jupyterSessionManager';
import { KernelSelectionProvider } from '../../../../client/datascience/jupyter/kernels/kernelSelections';
import { KernelSelector } from '../../../../client/datascience/jupyter/kernels/kernelSelector';
import { KernelService } from '../../../../client/datascience/jupyter/kernels/kernelService';
import { IJupyterSessionManager } from '../../../../client/datascience/types';
import { InterpreterType, PythonInterpreter } from '../../../../client/interpreter/contracts';

// tslint:disable-next-line: max-func-body-length
suite('Data Science - KernelSelector', () => {
    let kernelSelectionProvider: KernelSelectionProvider;
    let kernelService: KernelService;
    let sessionManager: IJupyterSessionManager;
    let kernelSelector: KernelSelector;
    let appShell: IApplicationShell;
    let installer: IInstaller;
    const kernelSpec = {
        display_name: 'Something',
        dispose: async () => noop(),
        language: PYTHON_LANGUAGE,
        name: '',
        path: ''
    };
    const interpreter: PythonInterpreter = {
        displayName: '',
        architecture: Architecture.Unknown,
        path: '',
        sysPrefix: '',
        sysVersion: '',
        type: InterpreterType.Conda
    };

    setup(() => {
        sessionManager = mock(JupyterSessionManager);
        kernelService = mock(KernelService);
        kernelSelectionProvider = mock(KernelSelectionProvider);
        appShell = mock(ApplicationShell);
        installer = mock(ProductInstaller);
        kernelSelector = new KernelSelector(instance(kernelSelectionProvider), instance(appShell), instance(kernelService), instance(installer));
    });

    test('Should display quick pick and return nothing when nothing is selected (remote sessions)', async () => {
        when(kernelSelectionProvider.getKernelSelectionsForRemoteSession(instance(sessionManager), anything())).thenResolve([]);
        when(appShell.showQuickPick(anything(), undefined, anything())).thenResolve();

        const kernel = await kernelSelector.selectRemoteKernel(instance(sessionManager));

        assert.isUndefined(kernel);
        verify(kernelSelectionProvider.getKernelSelectionsForRemoteSession(instance(sessionManager), anything())).once();
        verify(appShell.showQuickPick(anything(), undefined, anything())).once();
    });
    test('Should display quick pick and return nothing when nothing is selected (local sessions)', async () => {
        when(kernelSelectionProvider.getKernelSelectionsForLocalSession(instance(sessionManager), anything())).thenResolve([]);
        when(appShell.showQuickPick(anything(), undefined, anything())).thenResolve();

        const kernel = await kernelSelector.selectLocalKernel(instance(sessionManager));

        assert.isUndefined(kernel);
        verify(kernelSelectionProvider.getKernelSelectionsForLocalSession(instance(sessionManager), anything())).once();
        verify(appShell.showQuickPick(anything(), undefined, anything())).once();
    });
    test('Should return the selected remote kernelspec', async () => {
        when(kernelSelectionProvider.getKernelSelectionsForRemoteSession(instance(sessionManager), anything())).thenResolve([]);
        // tslint:disable-next-line: no-any
        when(appShell.showQuickPick(anything(), undefined, anything())).thenResolve({ selection: { kernelSpec } } as any);

        const kernel = await kernelSelector.selectRemoteKernel(instance(sessionManager));

        assert.isOk(kernel === kernelSpec);
        verify(kernelSelectionProvider.getKernelSelectionsForRemoteSession(instance(sessionManager), anything())).once();
        verify(appShell.showQuickPick(anything(), undefined, anything())).once();
    });
    test('Should return the selected local kernelspec', async () => {
        when(kernelSelectionProvider.getKernelSelectionsForLocalSession(instance(sessionManager), anything())).thenResolve([]);
        // tslint:disable-next-line: no-any
        when(appShell.showQuickPick(anything(), undefined, anything())).thenResolve({ selection: { kernelSpec } } as any);

        const kernel = await kernelSelector.selectLocalKernel(instance(sessionManager));

        assert.isOk(kernel === kernelSpec);
        verify(kernelSelectionProvider.getKernelSelectionsForLocalSession(instance(sessionManager), anything())).once();
        verify(appShell.showQuickPick(anything(), undefined, anything())).once();
    });
    test('Should return a kernelSpec if ipykernel is available in selected interpreter and matching kernelspec is found', async () => {
        when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(true);
        when(kernelService.findMatchingKernelSpec(interpreter, instance(sessionManager), anything())).thenResolve(kernelSpec);
        when(kernelSelectionProvider.getKernelSelectionsForLocalSession(instance(sessionManager), anything())).thenResolve([]);
        // tslint:disable-next-line: no-any
        when(appShell.showQuickPick(anything(), undefined, anything())).thenResolve({ selection: { interpreter, kernelSpec } } as any);

        const kernel = await kernelSelector.selectLocalKernel(instance(sessionManager));

        assert.isOk(kernel === kernelSpec);
        verify(installer.isInstalled(Product.ipykernel, interpreter)).once();
        verify(kernelService.findMatchingKernelSpec(interpreter, instance(sessionManager), anything())).once();
        verify(kernelSelectionProvider.getKernelSelectionsForLocalSession(instance(sessionManager), anything())).once();
        verify(appShell.showQuickPick(anything(), undefined, anything())).once();
    });
    test('Should return the registered kernelSpec if ipykernel is available in selected interpreter and no matching kernelspec is found', async () => {
        when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(true);
        when(kernelService.findMatchingKernelSpec(interpreter, instance(sessionManager), anything())).thenResolve();
        when(kernelService.registerKernel(interpreter, anything())).thenResolve(kernelSpec);
        when(kernelSelectionProvider.getKernelSelectionsForLocalSession(instance(sessionManager), anything())).thenResolve([]);
        // tslint:disable-next-line: no-any
        when(appShell.showQuickPick(anything(), undefined, anything())).thenResolve({ selection: { interpreter, kernelSpec } } as any);

        const kernel = await kernelSelector.selectLocalKernel(instance(sessionManager));

        assert.isOk(kernel === kernelSpec);
        verify(installer.isInstalled(Product.ipykernel, interpreter)).once();
        verify(kernelService.findMatchingKernelSpec(interpreter, instance(sessionManager), anything())).once();
        verify(kernelSelectionProvider.getKernelSelectionsForLocalSession(instance(sessionManager), anything())).once();
        verify(appShell.showQuickPick(anything(), undefined, anything())).once();
    });
    test('Should return the registered kernelSpec if ipykernel is not available and is installed in selected interpreter', async () => {
        when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(false);
        when(installer.promptToInstall(Product.ipykernel, interpreter)).thenResolve(InstallerResponse.Installed);
        when(kernelService.findMatchingKernelSpec(interpreter, instance(sessionManager), anything())).thenResolve();
        when(kernelService.registerKernel(interpreter, anything())).thenResolve(kernelSpec);
        when(kernelSelectionProvider.getKernelSelectionsForLocalSession(instance(sessionManager), anything())).thenResolve([]);
        // tslint:disable-next-line: no-any
        when(appShell.showQuickPick(anything(), undefined, anything())).thenResolve({ selection: { interpreter, kernelSpec } } as any);

        const kernel = await kernelSelector.selectLocalKernel(instance(sessionManager));

        assert.isOk(kernel === kernelSpec);
        verify(installer.isInstalled(Product.ipykernel, interpreter)).once();
        verify(installer.promptToInstall(Product.ipykernel, interpreter)).once();
        verify(kernelService.findMatchingKernelSpec(interpreter, instance(sessionManager), anything())).once();
        verify(kernelSelectionProvider.getKernelSelectionsForLocalSession(instance(sessionManager), anything())).once();
        verify(appShell.showQuickPick(anything(), undefined, anything())).once();
    });
});
