// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { PYTHON_LANGUAGE } from '../../../../client/common/constants';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../../client/common/platform/types';
import { ProcessServiceFactory } from '../../../../client/common/process/processFactory';
import { IProcessServiceFactory } from '../../../../client/common/process/types';
import { noop } from '../../../../client/common/utils/misc';
import { JupyterCommands } from '../../../../client/datascience/constants';
import { InterpreterJupyterNotebookCommand } from '../../../../client/datascience/jupyter/jupyterCommand';
import { JupyterCommandFinder, ModuleExistsStatus } from '../../../../client/datascience/jupyter/jupyterCommandFinder';
import { JupyterExecutionBase } from '../../../../client/datascience/jupyter/jupyterExecution';
import { JupyterSessionManager } from '../../../../client/datascience/jupyter/jupyterSessionManager';
import { KernelService } from '../../../../client/datascience/jupyter/kernels/kernelService';
import { IJupyterCommand, IJupyterExecution, IJupyterKernelSpec, IJupyterSessionManager } from '../../../../client/datascience/types';
import { IInterpreterService } from '../../../../client/interpreter/contracts';
import { InterpreterService } from '../../../../client/interpreter/interpreterService';

suite('Data Science - KernelService', () => {
    let kernelService: KernelService;
    let jupyterExecution: IJupyterExecution;
    let cmdFinder: JupyterCommandFinder;
    let processServiceFactory: IProcessServiceFactory;
    let interperterService: IInterpreterService;
    let fs: IFileSystem;
    let sessionManager: IJupyterSessionManager;
    let kernelSpecCmd: IJupyterCommand;

    setup(() => {
        jupyterExecution = mock(JupyterExecutionBase);
        cmdFinder = mock(JupyterCommandFinder);
        processServiceFactory = mock(ProcessServiceFactory);
        interperterService = mock(InterpreterService);
        fs = mock(FileSystem);
        sessionManager = mock(JupyterSessionManager);
        kernelSpecCmd = mock(InterpreterJupyterNotebookCommand);

        when(cmdFinder.findBestCommand(JupyterCommands.KernelSpecCommand)).thenResolve({ status: ModuleExistsStatus.Found, command: instance(kernelSpecCmd) });

        kernelService = new KernelService(
            instance(jupyterExecution),
            instance(cmdFinder),
            { push: noop, dispose: async () => noop() },
            instance(processServiceFactory),
            instance(interperterService),
            instance(fs)
        );
    });

    test('Should not return a matching spec from a session', async () => {
        const activeKernelSpecs: IJupyterKernelSpec[] = [
            { dispose: async () => noop(), language: PYTHON_LANGUAGE, name: '1', path: '', display_name: '1', metadata: {} },
            { dispose: async () => noop(), language: PYTHON_LANGUAGE, name: '2', path: '', display_name: '2', metadata: {} }
        ];
        when(sessionManager.getActiveKernelSpecs()).thenResolve(activeKernelSpecs);

        const matchingKernel = await kernelService.findMatchingKernelSpec({ name: 'A', display_name: 'A' }, instance(sessionManager));

        assert.isUndefined(matchingKernel);
        verify(sessionManager.getActiveKernelSpecs()).once();
    });
    test('Should not return a matching spec from a jupyter process', async () => {
        when(kernelSpecCmd.exec(deepEqual(['list', '--json']), anything())).thenResolve({ stdout: '{}' });

        const matchingKernel = await kernelService.findMatchingKernelSpec({ name: 'A', display_name: 'A' }, undefined);

        assert.isUndefined(matchingKernel);
        verify(kernelSpecCmd.exec(deepEqual(['list', '--json']), anything())).once();
    });
    test('Should return a matching spec from a session', async () => {
        const activeKernelSpecs: IJupyterKernelSpec[] = [
            { dispose: async () => noop(), language: PYTHON_LANGUAGE, name: '1', path: 'Path1', display_name: 'Disp1', metadata: {} },
            { dispose: async () => noop(), language: PYTHON_LANGUAGE, name: '2', path: 'Path2', display_name: 'Disp2', metadata: {} }
        ];
        when(sessionManager.getActiveKernelSpecs()).thenResolve(activeKernelSpecs);

        const matchingKernel = await kernelService.findMatchingKernelSpec({ name: '2', display_name: 'Disp2' }, instance(sessionManager));

        assert.isOk(matchingKernel);
        assert.equal(matchingKernel?.display_name, 'Disp2');
        assert.equal(matchingKernel?.name, '2');
        assert.equal(matchingKernel?.path, 'Path2');
        assert.equal(matchingKernel?.language, PYTHON_LANGUAGE);
        verify(sessionManager.getActiveKernelSpecs()).once();
    });
    test('Should return a matching spec from a jupyter process', async () => {
        const kernelSpecs = {
            K1: { spec: { display_name: 'disp1', language: PYTHON_LANGUAGE, metadata: { interpreter: { path: 'Some Path', envName: 'MyEnvName' } } } },
            K2: { spec: { display_name: 'disp2', language: PYTHON_LANGUAGE, metadata: { interpreter: { path: 'Some Path2', envName: 'MyEnvName2' } } } }
        };
        when(kernelSpecCmd.exec(deepEqual(['list', '--json']), anything())).thenResolve({ stdout: JSON.stringify(kernelSpecs) });

        const matchingKernel = await kernelService.findMatchingKernelSpec({ name: 'K2', display_name: 'disp2' }, undefined);

        assert.isOk(matchingKernel);
        assert.equal(matchingKernel?.display_name, 'disp2');
        assert.equal(matchingKernel?.name, 'K2');
        assert.equal(matchingKernel?.metadata?.interpreter?.path, 'Some Path2');
        assert.equal(matchingKernel?.metadata?.interpreter?.envName, 'MyEnvName2');
        assert.equal(matchingKernel?.language, PYTHON_LANGUAGE);
        verify(kernelSpecCmd.exec(deepEqual(['list', '--json']), anything())).once();
    });
});
