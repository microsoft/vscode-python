// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { PYTHON_LANGUAGE } from '../../../../client/common/constants';
import * as localize from '../../../../client/common/utils/localize';
import { noop } from '../../../../client/common/utils/misc';
import { Architecture } from '../../../../client/common/utils/platform';
import { JupyterSessionManager } from '../../../../client/datascience/jupyter/jupyterSessionManager';
import { KernelSelectionProvider } from '../../../../client/datascience/jupyter/kernels/kernelSelections';
import { KernelService } from '../../../../client/datascience/jupyter/kernels/kernelService';
import { IKernelSpecQuickPickItem } from '../../../../client/datascience/jupyter/kernels/types';
import { IJupyterKernel, IJupyterKernelSpec, IJupyterSessionManager } from '../../../../client/datascience/types';
import { InterpreterSelector } from '../../../../client/interpreter/configuration/interpreterSelector';
import { IInterpreterQuickPickItem, IInterpreterSelector } from '../../../../client/interpreter/configuration/types';
import { InterpreterType } from '../../../../client/interpreter/contracts';

// tslint:disable-next-line: max-func-body-length
suite('Data Science - KernelSelections', () => {
    let kernelSelectionProvider: KernelSelectionProvider;
    let kernelService: KernelService;
    let interpreterSelector: IInterpreterSelector;
    let sessionManager: IJupyterSessionManager;
    const activePython1KernelModel = { lastActivityTime: new Date(2011, 11, 10, 12, 15, 0, 0), numberOfConnections: 10, name: 'py1' };
    const activeJuliaKernelModel = { lastActivityTime: new Date(2001, 1, 1, 12, 15, 0, 0), numberOfConnections: 10, name: 'julia' };
    const python1KernelSpecModel = { display_name: 'Python display name', dispose: async () => noop(), language: PYTHON_LANGUAGE, name: 'py1', path: 'somePath', metadata: {} };
    const python3KernelSpecModel = { display_name: 'Python3', dispose: async () => noop(), language: PYTHON_LANGUAGE, name: 'py3', path: 'somePath3', metadata: {} };
    const juliaKernelSpecModel = { display_name: 'Julia display name', dispose: async () => noop(), language: 'julia', name: 'julia', path: 'j', metadata: {} };
    const rKernelSpecModel = { display_name: 'R', dispose: async () => noop(), language: 'r', name: 'r', path: 'r', metadata: {} };

    const allSpecs: IJupyterKernelSpec[] = [python1KernelSpecModel, python3KernelSpecModel, juliaKernelSpecModel, rKernelSpecModel];

    const allInterpreters: IInterpreterQuickPickItem[] = [
        {
            label: 'Hello1',
            interpreter: { architecture: Architecture.Unknown, path: 'p1', sysPrefix: '', sysVersion: '', type: InterpreterType.Conda, displayName: 'Hello1' },
            path: 'p1',
            detail: 'p1'
        },
        {
            label: 'Hello1',
            interpreter: { architecture: Architecture.Unknown, path: 'p2', sysPrefix: '', sysVersion: '', type: InterpreterType.Conda, displayName: 'Hello2' },
            path: 'p1',
            detail: 'p1'
        },
        {
            label: 'Hello1',
            interpreter: { architecture: Architecture.Unknown, path: 'p3', sysPrefix: '', sysVersion: '', type: InterpreterType.Conda, displayName: 'Hello3' },
            path: 'p1',
            detail: 'p1'
        }
    ];

    setup(() => {
        interpreterSelector = mock(InterpreterSelector);
        sessionManager = mock(JupyterSessionManager);
        kernelService = mock(KernelService);
        kernelSelectionProvider = new KernelSelectionProvider(instance(kernelService), instance(interpreterSelector));
    });

    test('Should return an empty list for remote kernels if there are none', async () => {
        when(sessionManager.getRunningKernels()).thenResolve([]);

        const items = await kernelSelectionProvider.getKernelSelectionsForRemoteSession(instance(sessionManager));

        assert.equal(items.length, 0);
    });
    test('Should return a list with the proper details in the quick pick for remote connections', async () => {
        const activeKernels: IJupyterKernel[] = [activePython1KernelModel, activeJuliaKernelModel];

        when(sessionManager.getRunningKernels()).thenResolve(activeKernels);
        when(sessionManager.getKernelSpecs()).thenResolve(allSpecs);

        // Quick pick must contain
        // - kernel spec display name
        // - selection = kernel model + kernel spec
        // - description = last activity and # of connections.
        const expectedItems: IKernelSpecQuickPickItem[] = [
            {
                label: python1KernelSpecModel.display_name,
                selection: { interpreter: undefined, kernelModel: { ...activePython1KernelModel, ...python1KernelSpecModel }, kernelSpec: undefined },
                description: localize.DataScience.jupyterSelectURIRunningDetailFormat().format(
                    activePython1KernelModel.lastActivityTime.toLocaleString(),
                    activePython1KernelModel.numberOfConnections.toString()
                )
            },
            {
                label: juliaKernelSpecModel.display_name,
                selection: { interpreter: undefined, kernelModel: { ...activeJuliaKernelModel, ...juliaKernelSpecModel }, kernelSpec: undefined },
                description: localize.DataScience.jupyterSelectURIRunningDetailFormat().format(
                    activeJuliaKernelModel.lastActivityTime.toLocaleString(),
                    activeJuliaKernelModel.numberOfConnections.toString()
                )
            }
        ];
        const items = await kernelSelectionProvider.getKernelSelectionsForRemoteSession(instance(sessionManager));

        verify(sessionManager.getRunningKernels()).once();
        verify(sessionManager.getKernelSpecs()).once();
        assert.deepEqual(items, expectedItems);
    });
    test('Should return a list Active + Local Kernels + Interpreters for local connection', async () => {
        const activeKernels: IJupyterKernel[] = [activePython1KernelModel, activeJuliaKernelModel];

        when(sessionManager.getRunningKernels()).thenResolve(activeKernels);
        when(sessionManager.getKernelSpecs()).thenResolve(allSpecs);
        when(kernelService.getKernelSpecs(anything(), anything())).thenResolve(allSpecs);
        when(interpreterSelector.getSuggestions(undefined)).thenResolve(allInterpreters);

        // Quick pick must contain
        // - kernel spec display name
        // - selection = kernel model + kernel spec
        // - description = last activity and # of connections.
        const expectedRemoteItems: IKernelSpecQuickPickItem[] = [
            {
                label: python1KernelSpecModel.display_name,
                selection: { interpreter: undefined, kernelModel: { ...activePython1KernelModel, ...python1KernelSpecModel }, kernelSpec: undefined },
                description: localize.DataScience.jupyterSelectURIRunningDetailFormat().format(
                    activePython1KernelModel.lastActivityTime.toLocaleString(),
                    activePython1KernelModel.numberOfConnections.toString()
                )
            },
            {
                label: juliaKernelSpecModel.display_name,
                selection: { interpreter: undefined, kernelModel: { ...activeJuliaKernelModel, ...juliaKernelSpecModel }, kernelSpec: undefined },
                description: localize.DataScience.jupyterSelectURIRunningDetailFormat().format(
                    activeJuliaKernelModel.lastActivityTime.toLocaleString(),
                    activeJuliaKernelModel.numberOfConnections.toString()
                )
            }
        ];
        const expectedKernelItems: IKernelSpecQuickPickItem[] = allSpecs.map(item => {
            return {
                label: item.display_name,
                selection: { interpreter: undefined, kernelModel: undefined, kernelSpec: item },
                description: '(kernel)'
            };
        });
        const expectedInterpreterItems: IKernelSpecQuickPickItem[] = allInterpreters.map(item => {
            return {
                ...item,
                description: '(register and use interpreter as kernel)',
                selection: { kernelModel: undefined, interpreter: item.interpreter, kernelSpec: undefined }
            };
        });
        const items = await kernelSelectionProvider.getKernelSelectionsForLocalSession(instance(sessionManager));

        verify(sessionManager.getRunningKernels()).once();
        verify(sessionManager.getKernelSpecs()).once();
        assert.deepEqual(items, [...expectedKernelItems, ...expectedRemoteItems, ...expectedInterpreterItems]);
    });
});
