// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { EventEmitter, Uri } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { DaemonExecutionFactoryCreationOptions, IPythonExecutionFactory } from '../../../client/common/process/types';
import { ReadWrite, Resource } from '../../../client/common/types';
import { IEnvironmentVariablesProvider } from '../../../client/common/variables/types';
import { KernelDaemonPool } from '../../../client/datascience/kernel-launcher/kernelDaemonPool';
import { IPythonKernelDaemon } from '../../../client/datascience/kernel-launcher/types';
import {
    IDataScienceFileSystem,
    IJupyterKernelSpec,
    IKernelDependencyService
} from '../../../client/datascience/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { PythonEnvironment } from '../../../client/pythonEnvironments/info';
import { sleep } from '../../core';
import { createPythonInterpreter } from '../../utils/interpreters';

// tslint:disable: max-func-body-length no-any
suite('DataScience - Kernel Daemon Pool', () => {
    const interpreter1 = createPythonInterpreter({ path: 'interpreter1' });
    const interpreter2 = createPythonInterpreter({ path: 'interpreter2' });
    const interpreter3 = createPythonInterpreter({ path: 'interpreter3' });
    const workspace1 = Uri.file('1');
    const workspace2 = Uri.file('2');
    const workspace3 = Uri.file('3');
    let didEnvVarsChange: EventEmitter<Resource>;
    let didChangeInterpreter: EventEmitter<void>;
    let daemon1: IPythonKernelDaemon;
    let daemon2: IPythonKernelDaemon;
    let daemon3: IPythonKernelDaemon;
    let daemonPool: KernelDaemonPool;
    let worksapceService: IWorkspaceService;
    let kernelDependencyService: IKernelDependencyService;
    let pythonExecutionFactory: IPythonExecutionFactory;
    let envVars: IEnvironmentVariablesProvider;
    let fs: IDataScienceFileSystem;
    let interpeterService: IInterpreterService;
    let kernelSpec: ReadWrite<IJupyterKernelSpec>;
    let interpretersPerWorkspace: Map<string | undefined, PythonEnvironment>;

    setup(() => {
        didEnvVarsChange = new EventEmitter<Resource>();
        didChangeInterpreter = new EventEmitter<void>();
        worksapceService = mock<IWorkspaceService>();
        kernelDependencyService = mock<IKernelDependencyService>();
        daemon1 = mock<IPythonKernelDaemon>();
        daemon2 = mock<IPythonKernelDaemon>();
        daemon3 = mock<IPythonKernelDaemon>();
        pythonExecutionFactory = mock<IPythonExecutionFactory>();
        envVars = mock<IEnvironmentVariablesProvider>();
        fs = mock<IDataScienceFileSystem>();
        interpeterService = mock<IInterpreterService>();
        interpretersPerWorkspace = new Map<string | undefined, PythonEnvironment>();
        interpretersPerWorkspace.set(workspace1.fsPath, interpreter1);
        interpretersPerWorkspace.set(workspace2.fsPath, interpreter2);
        interpretersPerWorkspace.set(workspace3.fsPath, interpreter3);

        (instance(daemon1) as any).then = undefined;
        (instance(daemon2) as any).then = undefined;
        (instance(daemon3) as any).then = undefined;
        when(daemon1.preWarm()).thenResolve();
        when(daemon2.preWarm()).thenResolve();
        when(daemon3.preWarm()).thenResolve();
        when(daemon1.dispose()).thenResolve();
        when(daemon2.dispose()).thenResolve();
        when(daemon3.dispose()).thenResolve();

        when(envVars.onDidEnvironmentVariablesChange).thenReturn(didEnvVarsChange.event);
        when(interpeterService.onDidChangeInterpreter).thenReturn(didChangeInterpreter.event);
        when(interpeterService.getActiveInterpreter(anything())).thenCall((uri?: Uri) =>
            interpretersPerWorkspace.get(uri?.fsPath)
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
            instance(interpeterService),
            instance(pythonExecutionFactory),
            instance(kernelDependencyService)
        );
        kernelSpec = {
            argv: ['python', '-m', 'ipkernel_launcher', '-f', 'file.json'],
            display_name: '',
            env: undefined,
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
        await daemonPool.preWarmKernelDaemons();

        // Verify we only created 2 daemons.
        assert.equal(daemonPool.daemons, 2);

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
        assert.equal(daemonPool.daemons, 2);
    });
    test('Pre-warming multiple times has no affect', async () => {
        when(worksapceService.workspaceFolders).thenReturn([
            { index: 0, name: '', uri: workspace1 },
            { index: 0, name: '', uri: workspace2 }
        ]);
        await daemonPool.preWarmKernelDaemons();

        // Verify we only created 2 daemons.
        assert.equal(daemonPool.daemons, 2);

        // attempting to pre-warm again should be a noop.
        await daemonPool.preWarmKernelDaemons();
        await daemonPool.preWarmKernelDaemons();
        await daemonPool.preWarmKernelDaemons();

        // Verify we only created 2 daemons.
        assert.equal(daemonPool.daemons, 2);
    });
    test('Disposing daemonpool should kill all daemons in the pool', async () => {
        when(worksapceService.workspaceFolders).thenReturn([
            { index: 0, name: '', uri: workspace1 },
            { index: 0, name: '', uri: workspace2 }
        ]);
        await daemonPool.preWarmKernelDaemons();

        // Verify we only created 2 daemons.
        assert.equal(daemonPool.daemons, 2);

        // Confirm daemons have been craeted.
        verify(daemon1.preWarm()).once();
        verify(daemon2.preWarm()).once();

        daemonPool.dispose();

        // Confirm daemons have been disposed.
        verify(daemon1.dispose()).once();
        verify(daemon2.dispose()).once();
    });
    test('Create new daemons even when not prewarmed', async () => {
        const daemon = await daemonPool.get(workspace1, kernelSpec, interpreter1);
        assert.equal(daemon, instance(daemon1));
        // Verify this daemon was not pre-warmed.
        verify(daemon1.preWarm()).never();

        // Wait for background async to complete.
        await sleep(1);
        assert.equal(daemonPool.daemons, 0);
    });
    test('Create a new daemon if we do not have a pre-warmed daemon', async () => {
        when(worksapceService.workspaceFolders).thenReturn([
            { index: 0, name: '', uri: workspace1 },
            { index: 0, name: '', uri: workspace2 }
        ]);
        await daemonPool.preWarmKernelDaemons();

        // Verify we only created 2 daemons.
        assert.equal(daemonPool.daemons, 2);

        const daemon = await daemonPool.get(workspace3, kernelSpec, interpreter3);
        assert.equal(daemon, instance(daemon3));
        // Verify this daemon was not pre-warmed.
        verify(daemon3.preWarm()).never();
    });
    test('Create a new daemon if our kernelspec has environment variables (will not use one from the pool of daemons)', async () => {
        when(worksapceService.workspaceFolders).thenReturn([
            { index: 0, name: '', uri: workspace1 },
            { index: 0, name: '', uri: workspace2 }
        ]);
        await daemonPool.preWarmKernelDaemons();
        // Verify we created just 2 daemons.
        verify(pythonExecutionFactory.createDaemon(anything())).twice();

        kernelSpec.env = { HELLO: '1' };
        const daemon = await daemonPool.get(workspace3, kernelSpec, interpreter3);
        assert.equal(daemon, instance(daemon3));
        // Verify this daemon was not pre-warmed.
        verify(daemon3.preWarm()).never();

        // Wait for background async to complete.
        await sleep(1);
        // Verify we created just 1 extra new daemon (2 previously prewarmed, one for the new damone).
        verify(pythonExecutionFactory.createDaemon(anything())).times(3);
    });
    test('After updating env varialbes we will always create new daemons, and not use the ones from the daemon pool', async () => {
        when(worksapceService.workspaceFolders).thenReturn([
            { index: 0, name: '', uri: workspace1 },
            { index: 0, name: '', uri: workspace2 }
        ]);
        await daemonPool.preWarmKernelDaemons();
        // Verify we created just 2 daemons.
        assert.equal(daemonPool.daemons, 2);

        // Update env vars for worksapce 1.
        didEnvVarsChange.fire(workspace1);
        // Wait for background async to complete.
        await sleep(1);

        const daemon = await daemonPool.get(workspace1, kernelSpec, interpreter1);
        // Verify it is a whole new daemon.
        assert.notEqual(daemon, instance(daemon1));
        assert.notEqual(daemon, instance(daemon2));
        assert.notEqual(daemon, instance(daemon3));
        // Verify the pre-warmed daemon for workspace 1 was disposed.
        verify(daemon1.dispose()).once();
    });
    test('After selecting a new interpreter we will always create new daemons, and not use the ones from the daemon pool', async () => {
        when(worksapceService.workspaceFolders).thenReturn([
            { index: 0, name: '', uri: workspace1 },
            { index: 0, name: '', uri: workspace2 }
        ]);
        await daemonPool.preWarmKernelDaemons();
        // Verify we created just 2 daemons.
        assert.equal(daemonPool.daemons, 2);

        // Update interpreter for workespace1.
        when(interpeterService.getActiveInterpreter(anything())).thenCall((uri?: Uri) => {
            if (uri?.fsPath === workspace1.fsPath) {
                return createPythonInterpreter({ path: 'New' });
            }
            interpretersPerWorkspace.get(uri?.fsPath);
        });
        didChangeInterpreter.fire();
        // Wait for background async to complete.
        await sleep(1);

        const daemon = await daemonPool.get(workspace1, kernelSpec, interpreter1);
        // Verify it is a whole new daemon.
        assert.notEqual(daemon, instance(daemon1));
        assert.notEqual(daemon, instance(daemon2));
        assert.notEqual(daemon, instance(daemon3));
        // Verify the pre-warmed daemon for workspace 1 was disposed.
        verify(daemon1.dispose()).once();
    });
});
