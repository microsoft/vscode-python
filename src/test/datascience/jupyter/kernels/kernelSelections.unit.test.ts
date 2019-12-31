// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { PYTHON_LANGUAGE } from '../../../../client/common/constants';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { PathUtils } from '../../../../client/common/platform/pathUtils';
import { IFileSystem } from '../../../../client/common/platform/types';
import { IPathUtils } from '../../../../client/common/types';
import * as localize from '../../../../client/common/utils/localize';
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
    let pathUtils: IPathUtils;
    let fs: IFileSystem;
    let sessionManager: IJupyterSessionManager;
    const activePython1KernelModel = { lastActivityTime: new Date(2011, 11, 10, 12, 15, 0, 0), numberOfConnections: 10, name: 'py1' };
    const activeJuliaKernelModel = { lastActivityTime: new Date(2001, 1, 1, 12, 15, 0, 0), numberOfConnections: 10, name: 'julia' };
    const python1KernelSpecModel = { argv: [], display_name: 'Python display name', language: PYTHON_LANGUAGE, name: 'py1', path: 'somePath', metadata: {} };
    const python3KernelSpecModel = { argv: [], display_name: 'Python3', language: PYTHON_LANGUAGE, name: 'py3', path: 'somePath3', metadata: {} };
    const juliaKernelSpecModel = { argv: [], display_name: 'Julia display name', language: 'julia', name: 'julia', path: 'j', metadata: {} };
    const rKernelSpecModel = { argv: [], display_name: 'R', language: 'r', name: 'r', path: 'r', metadata: {} };

    const allSpecs: IJupyterKernelSpec[] = [python1KernelSpecModel, python3KernelSpecModel, juliaKernelSpecModel, rKernelSpecModel];

    const allInterpreters: IInterpreterQuickPickItem[] = [
        {
            label: 'Hello1',
            interpreter: { architecture: Architecture.Unknown, path: 'p1', sysPrefix: '', sysVersion: '', type: InterpreterType.Conda, displayName: 'Hello1' },
            path: 'p1',
            detail: '<user friendly path>',
            description: ''
        },
        {
            label: 'Hello1',
            interpreter: { architecture: Architecture.Unknown, path: 'p2', sysPrefix: '', sysVersion: '', type: InterpreterType.Conda, displayName: 'Hello2' },
            path: 'p1',
            detail: '<user friendly path>',
            description: ''
        },
        {
            label: 'Hello1',
            interpreter: { architecture: Architecture.Unknown, path: 'p3', sysPrefix: '', sysVersion: '', type: InterpreterType.Conda, displayName: 'Hello3' },
            path: 'p1',
            detail: '<user friendly path>',
            description: ''
        }
    ];

    setup(() => {
        interpreterSelector = mock(InterpreterSelector);
        sessionManager = mock(JupyterSessionManager);
        kernelService = mock(KernelService);
        fs = mock(FileSystem);
        pathUtils = mock(PathUtils);
        when(pathUtils.getDisplayName(anything())).thenReturn('<user friendly path>');
        when(pathUtils.getDisplayName(anything(), anything())).thenReturn('<user friendly path>');
        kernelSelectionProvider = new KernelSelectionProvider(instance(kernelService), instance(interpreterSelector), instance(fs), instance(pathUtils));
    });

    test('Should return an empty list for remote kernels if there are none', async () => {
        when(kernelService.getKernelSpecs(instance(sessionManager), anything())).thenResolve([]);
        when(sessionManager.getRunningKernels()).thenResolve([]);
        when(sessionManager.getRunningSessions()).thenResolve([]);

        const items = await kernelSelectionProvider.getKernelSelectionsForRemoteSession(instance(sessionManager));

        assert.equal(items.length, 0);
    });
    test('Should return a list with the proper details in the quick pick for remote connections (excluding non-python kernels)', async () => {
        const activeKernels: IJupyterKernel[] = [activePython1KernelModel, activeJuliaKernelModel];
        const sessions = activeKernels.map(item => {
            return {
                id: 'sessionId',
                name: 'someSession',
                // tslint:disable-next-line: no-any
                kernel: item as any,
                type: '',
                path: ''
            };
        });
        when(kernelService.getKernelSpecs(instance(sessionManager), anything())).thenResolve([]);
        when(sessionManager.getRunningKernels()).thenResolve(activeKernels);
        when(sessionManager.getRunningSessions()).thenResolve(sessions);
        when(sessionManager.getKernelSpecs()).thenResolve(allSpecs);

        // Quick pick must contain
        // - kernel spec display name
        // - selection = kernel model + kernel spec
        // - description = last activity and # of connections.
        const expectedItems: IKernelSpecQuickPickItem[] = [
            {
                label: python1KernelSpecModel.display_name,
                // tslint:disable-next-line: no-any
                selection: {
                    interpreter: undefined,
                    kernelModel: {
                        ...activePython1KernelModel,
                        ...python1KernelSpecModel,
                        session: {
                            id: 'sessionId',
                            name: 'someSession',
                            // tslint:disable-next-line: no-any
                            kernel: activeKernels[0] as any,
                            type: '',
                            path: ''
                            // tslint:disable-next-line: no-any
                        } as any
                    },
                    kernelSpec: undefined
                },
                detail: '<user friendly path>',
                description: localize.DataScience.jupyterSelectURIRunningDetailFormat().format(
                    activePython1KernelModel.lastActivityTime.toLocaleString(),
                    activePython1KernelModel.numberOfConnections.toString()
                )
            }
        ];
        expectedItems.sort((a, b) => (a.label === b.label ? 0 : a.label > b.label ? 1 : -1));

        const items = await kernelSelectionProvider.getKernelSelectionsForRemoteSession(instance(sessionManager));

        verify(sessionManager.getRunningKernels()).once();
        verify(sessionManager.getKernelSpecs()).once();
        assert.deepEqual(items, expectedItems);
    });
    test('Should return a list of Local Kernels + Interpreters for local connection (excluding non-python kernels)', async () => {
        when(sessionManager.getKernelSpecs()).thenResolve(allSpecs);
        when(kernelService.getKernelSpecs(anything(), anything())).thenResolve(allSpecs);
        when(interpreterSelector.getSuggestions(undefined)).thenResolve(allInterpreters);

        // Quick pick must contain
        // - kernel spec display name
        // - selection = kernel model + kernel spec
        // - description = last activity and # of connections.
        const expectedKernelItems: IKernelSpecQuickPickItem[] = [python1KernelSpecModel, python3KernelSpecModel].map(item => {
            return {
                label: item.display_name,
                detail: '<user friendly path>',
                selection: { interpreter: undefined, kernelModel: undefined, kernelSpec: item }
            };
        });
        const expectedInterpreterItems: IKernelSpecQuickPickItem[] = allInterpreters.map(item => {
            return {
                ...item,
                label: item.label,
                detail: '<user friendly path>',
                description: '',
                selection: { kernelModel: undefined, interpreter: item.interpreter, kernelSpec: undefined }
            };
        });
        const expectedList = [...expectedKernelItems, ...expectedInterpreterItems];
        expectedList.sort((a, b) => (a.label === b.label ? 0 : a.label > b.label ? 1 : -1));

        const items = await kernelSelectionProvider.getKernelSelectionsForLocalSession(instance(sessionManager));

        verify(kernelService.getKernelSpecs(anything(), anything())).once();
        assert.deepEqual(items, expectedList);
    });
});
