// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { IFileSystem } from '../../../client/common/platform/types';
import { DaemonExecutionFactoryCreationOptions, IPythonExecutionFactory } from '../../../client/common/process/types';
import { ReadWrite } from '../../../client/common/types';
import { IEnvironmentVariablesProvider } from '../../../client/common/variables/types';
import { KernelDaemonPool } from '../../../client/datascience/kernel-launcher/kernelDaemonPool';
import { IPythonKernelDaemon } from '../../../client/datascience/kernel-launcher/types';
import { IJupyterKernelSpec, IKernelDependencyService } from '../../../client/datascience/types';
import { IInterpreterService, PythonInterpreter } from '../../../client/interpreter/contracts';
import { sleep } from '../../core';
import { createPythonInterpreter } from '../../utils/interpreters';

// tslint:disable: max-func-body-length no-any
suite('Data Science - Kernel Daemon Pool', () => {
    const interpreter1 = createPythonInterpreter({ path: 'interpreter1' });
    const interpreter2 = createPythonInterpreter({ path: 'interpreter2' });
    const interpreter3 = createPythonInterpreter({ path: 'interpreter3' });
    const workspace1 = Uri.file('1');
    const workspace2 = Uri.file('2');
    const workspace3 = Uri.file('3');
    let daemon1: IPythonKernelDaemon;
    let daemon2: IPythonKernelDaemon;
    let daemon3: IPythonKernelDaemon;
    let daemonPool: KernelDaemonPool;
    let worksapceService: IWorkspaceService;
    let kernelDependencyService: IKernelDependencyService;
    let pythonExecutionFactory: IPythonExecutionFactory;
    let envVars: IEnvironmentVariablesProvider;
    let fs: IFileSystem;
    let interrpeterService: IInterpreterService;
    let kernelSpec: ReadWrite<IJupyterKernelSpec>;

    setup(() => {
        worksapceService = mock<IWorkspaceService>();
        kernelDependencyService = mock<IKernelDependencyService>();
        daemon1 = mock<IPythonKernelDaemon>();
        daemon2 = mock<IPythonKernelDaemon>();
        daemon3 = mock<IPythonKernelDaemon>();
        pythonExecutionFactory = mock<IPythonExecutionFactory>();
        envVars = mock<IEnvironmentVariablesProvider>();
        fs = mock<IFileSystem>();
        interrpeterService = mock<IInterpreterService>();
        const interpreters = new Map<string | undefined, PythonInterpreter>();
        interpreters.set(workspace1.fsPath, interpreter1);
        interpreters.set(workspace2.fsPath, interpreter2);
        interpreters.set(workspace3.fsPath, interpreter3);

        (instance(daemon1) as any).then = undefined;
        (instance(daemon2) as any).then = undefined;
        (instance(daemon3) as any).then = undefined;
        when(daemon1.preWarm()).thenResolve();
        when(daemon2.preWarm()).thenResolve();
        when(daemon3.preWarm()).thenResolve();

        when(interrpeterService.getActiveInterpreter(anything())).thenCall((uri?: Uri) =>
            interpreters.get(uri?.fsPath)
        );
        const daemonsCreatedForEachInterpreter = new Set<string>();
        when(pythonExecutionFactory.createDaemon(anything())).thenCall(
            async (options: DaemonExecutionFactoryCreationOptions) => {
                // Don't re-use daemons, just return a new one (else it stuffs up tests).
                // I.e. we created a daemon once, then next time return a new daemon object.
                if (daemonsCreatedForEachInterpreter.has(options.pythonPath!)) {
                    const newDaemon = mock<IPythonKernelDaemon>();
                    (instance(newDaemon) as any).then = undefined;
                    return instance(newDaemon);
                }

                daemonsCreatedForEachInterpreter.add(options.pythonPath!);
                switch (options.pythonPath) {
                    case interpreter1.path:
                        return instance(daemon1);
                    case interpreter2.path:
                        return instance(daemon2);
                    case interpreter3.path:
                        return instance(daemon3);
                    default:
                        const newDaemon = mock<IPythonKernelDaemon>();
                        (instance(newDaemon) as any).then = undefined;
                        return instance(newDaemon);
                }
            }
        );
        when(kernelDependencyService.areDependenciesInstalled(anything())).thenResolve(true);
        when(worksapceService.getWorkspaceFolderIdentifier(anything())).thenCall((uri: Uri) => uri.fsPath);
        daemonPool = new KernelDaemonPool(
            instance(worksapceService),
            instance(envVars),
            instance(fs),
            instance(interrpeterService),
            instance(pythonExecutionFactory),
            instance(kernelDependencyService)
        );
        kernelSpec = {
            argv: ['python', '-m', 'ipkernel_launcher', '-f', 'file.json'],
            display_name: '',
            env: { hello: '1' },
            language: 'python',
            name: '',
            path: ''
        };
    });
    test('Confirm we get pre-warmed daemons instead of creating new ones', async () => {
        when(worksapceService.workspaceFolders).thenReturn([
            { index: 0, name: '', uri: workspace1 },
            { index: 0, name: '', uri: workspace2 }
        ]);
        kernelSpec.env = undefined;
        await daemonPool.preWarmKernelDaemons();

        // Verify we only created 2 daemons.
        verify(pythonExecutionFactory.createDaemon(anything())).twice();

        let daemon = await daemonPool.get(workspace1, kernelSpec, interpreter1);
        assert.equal(daemon, instance(daemon1));
        // Verify this daemon was pre-warmed.
        verify(daemon1.preWarm()).atLeast(1);

        daemon = await daemonPool.get(workspace2, kernelSpec, interpreter2);
        assert.equal(daemon, instance(daemon2));
        // Verify this daemon was pre-warmed.
        verify(daemon1.preWarm()).atLeast(1);

        // Wait for background async to complete.
        await sleep(1);
        // Verify we created 2 more daemons.
        verify(pythonExecutionFactory.createDaemon(anything())).times(4);
    });
    test('Create new daemons even when not prewarmed', async () => {
        kernelSpec.env = undefined;

        const daemon = await daemonPool.get(workspace1, kernelSpec, interpreter1);
        assert.equal(daemon, instance(daemon1));
        // Verify this daemon was not pre-warmed.
        verify(daemon1.preWarm()).never();

        // Wait for background async to complete.
        await sleep(1);
        // Verify we created 2 daemons (1 now and 1 for future usage).
        verify(pythonExecutionFactory.createDaemon(anything())).times(2);
    });
    test('Create a new daemon if we do not have a pre-warmed daemon', async () => {
        when(worksapceService.workspaceFolders).thenReturn([
            { index: 0, name: '', uri: workspace1 },
            { index: 0, name: '', uri: workspace2 }
        ]);
        kernelSpec.env = undefined;
        await daemonPool.preWarmKernelDaemons();

        // Verify we only created 2 daemons.
        verify(pythonExecutionFactory.createDaemon(anything())).twice();

        const daemon = await daemonPool.get(workspace3, kernelSpec, interpreter3);
        assert.equal(daemon, instance(daemon3));
        // Verify this daemon was not pre-warmed.
        verify(daemon3.preWarm()).never();
    });
});
