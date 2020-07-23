// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { EventEmitter } from 'vscode';
import { IExtensionSingleActivationService } from '../../client/activation/types';
import { PythonExecutionFactory } from '../../client/common/process/pythonExecutionFactory';
import { IPythonExecutionFactory } from '../../client/common/process/types';
import { sleep } from '../../client/common/utils/async';
import { Activation } from '../../client/datascience/activation';
import { JupyterDaemonModule } from '../../client/datascience/constants';
import { ActiveEditorContextService } from '../../client/datascience/context/activeEditorContext';
import { NativeEditor } from '../../client/datascience/interactive-ipynb/nativeEditor';
import { NativeEditorProvider } from '../../client/datascience/interactive-ipynb/nativeEditorProvider';
import { JupyterInterpreterService } from '../../client/datascience/jupyter/interpreter/jupyterInterpreterService';
import { KernelDaemonPreWarmer } from '../../client/datascience/kernel-launcher/kernelDaemonPreWarmer';
import {
    INotebookAndInteractiveWindowUsageTracker,
    INotebookEditor,
    INotebookEditorProvider
} from '../../client/datascience/types';
import { PythonInterpreter } from '../../client/pythonEnvironments/info';
import { FakeClock } from '../common';
import { createPythonInterpreter } from '../utils/interpreters';

suite('DataScience - Activation', () => {
    let activator: IExtensionSingleActivationService;
    let notebookEditorProvider: INotebookEditorProvider;
    let jupyterInterpreterService: JupyterInterpreterService;
    let executionFactory: IPythonExecutionFactory;
    let openedEventEmitter: EventEmitter<INotebookEditor>;
    let interpreterEventEmitter: EventEmitter<PythonInterpreter>;
    let contextService: ActiveEditorContextService;
    let fakeTimer: FakeClock;
    const interpreter = createPythonInterpreter();

    setup(async () => {
        fakeTimer = new FakeClock();
        openedEventEmitter = new EventEmitter<INotebookEditor>();
        interpreterEventEmitter = new EventEmitter<PythonInterpreter>();
        const tracker = mock<INotebookAndInteractiveWindowUsageTracker>();

        notebookEditorProvider = mock(NativeEditorProvider);
        jupyterInterpreterService = mock(JupyterInterpreterService);
        executionFactory = mock(PythonExecutionFactory);
        contextService = mock(ActiveEditorContextService);
        const daemonPool = mock(KernelDaemonPreWarmer);
        when(notebookEditorProvider.onDidOpenNotebookEditor).thenReturn(openedEventEmitter.event);
        when(jupyterInterpreterService.onDidChangeInterpreter).thenReturn(interpreterEventEmitter.event);
        when(executionFactory.createDaemon(anything())).thenResolve();
        when(contextService.activate()).thenResolve();
        when(daemonPool.activate(anything())).thenResolve();
        activator = new Activation(
            instance(notebookEditorProvider),
            instance(jupyterInterpreterService),
            instance(executionFactory),
            [],
            instance(contextService),
            instance(daemonPool),
            instance(tracker)
        );
        when(jupyterInterpreterService.getSelectedInterpreter()).thenResolve(interpreter);
        when(jupyterInterpreterService.getSelectedInterpreter(anything())).thenResolve(interpreter);
        when(jupyterInterpreterService.setInitialInterpreter()).thenResolve(interpreter);
        await activator.activate();
    });
    teardown(() => fakeTimer.uninstall());
    async function testCreatingDaemonWhenOpeningANotebook() {
        fakeTimer.install();
        const notebook: INotebookEditor = mock(NativeEditor);

        // Open a notebook, (fire the event).
        openedEventEmitter.fire(notebook);

        // Wait for debounce to complete.
        await fakeTimer.wait();

        verify(executionFactory.createDaemon(anything())).once();
        verify(
            executionFactory.createDaemon(
                deepEqual({ daemonModule: JupyterDaemonModule, pythonPath: interpreter.path })
            )
        ).once();
    }

    test('Create a daemon when a notebook is opened', async () => testCreatingDaemonWhenOpeningANotebook());

    test('Create a daemon when changing interpreter after a notebook has beeen opened', async () => {
        await testCreatingDaemonWhenOpeningANotebook();

        // Trigger changes to interpreter.
        interpreterEventEmitter.fire(interpreter);

        // Wait for debounce to complete.
        await fakeTimer.wait();

        verify(
            executionFactory.createDaemon(
                deepEqual({ daemonModule: JupyterDaemonModule, pythonPath: interpreter.path })
            )
        ).twice();
    });
    test('Changing interpreter without opening a notebook does not result in a daemon being created', async () => {
        // Trigger changes to interpreter.
        interpreterEventEmitter.fire(interpreter);

        // Assume a debounce is required and wait.
        await sleep(10);

        verify(executionFactory.createDaemon(anything())).never();
    });
});
