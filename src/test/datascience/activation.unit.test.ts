// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { EventEmitter } from 'vscode';
import { IExtensionSingleActivationService } from '../../client/activation/types';
import { PythonExecutionFactory } from '../../client/common/process/pythonExecutionFactory';
import { IPythonExecutionFactory } from '../../client/common/process/types';
import { Activation } from '../../client/datascience/activation';
import { PythonDaemonModule } from '../../client/datascience/constants';
import { ActiveEditorContextService } from '../../client/datascience/context/activeEditorContext';
import { NativeEditor } from '../../client/datascience/interactive-ipynb/nativeEditor';
import { NativeEditorProvider } from '../../client/datascience/interactive-ipynb/nativeEditorProvider';
import { INotebookEditor, INotebookEditorProvider } from '../../client/datascience/types';
import { IInterpreterService, PythonInterpreter } from '../../client/interpreter/contracts';
import { InterpreterService } from '../../client/interpreter/interpreterService';
import { sleep } from '../core';

// tslint:disable: no-any

suite('Data Science - Activation', () => {
    let activator: IExtensionSingleActivationService;
    let notebookProvider: INotebookEditorProvider;
    let interpreterService: IInterpreterService;
    let executionFactory: IPythonExecutionFactory;
    let openedEventEmitter: EventEmitter<INotebookEditor>;
    let interpreterEventEmitter: EventEmitter<void>;
    let contextService: ActiveEditorContextService;
    setup(async () => {
        openedEventEmitter = new EventEmitter<INotebookEditor>();
        interpreterEventEmitter = new EventEmitter<void>();

        notebookProvider = mock(NativeEditorProvider);
        interpreterService = mock(InterpreterService);
        executionFactory = mock(PythonExecutionFactory);
        contextService = mock(ActiveEditorContextService);
        when(notebookProvider.onDidOpenNotebookEditor).thenReturn(openedEventEmitter.event);
        when(interpreterService.onDidChangeInterpreter).thenReturn(interpreterEventEmitter.event);
        when(executionFactory.createDaemon(anything())).thenResolve();
        when(contextService.activate()).thenResolve();
        activator = new Activation(instance(notebookProvider), instance(interpreterService), instance(executionFactory), [], instance(contextService));
        await activator.activate();
    });

    async function testCreatingDaemonWhenOpeningANotebook() {
        const notebook: INotebookEditor = mock(NativeEditor);
        const interpreter = ({ path: 'MY_PY' } as any) as PythonInterpreter;

        when(interpreterService.getActiveInterpreter(undefined)).thenResolve(interpreter);

        // Open a notebook, (fire the event).
        openedEventEmitter.fire(notebook);

        // Wait for deounce to complete.
        await sleep(1000);

        verify(interpreterService.getActiveInterpreter(undefined)).once();
        verify(executionFactory.createDaemon(deepEqual({ daemonModule: PythonDaemonModule, pythonPath: interpreter.path }))).once();
    }

    test('Create a daemon when a notebook is opened', async () => testCreatingDaemonWhenOpeningANotebook);

    test('Create a daemon when changing interpreter after a notebook has beeen opened', async () => {
        await testCreatingDaemonWhenOpeningANotebook();

        // Trigger changes to interpreter.
        interpreterEventEmitter.fire();

        // Wait for deounce to complete.
        await sleep(1000);

        verify(interpreterService.getActiveInterpreter(undefined)).twice();
        verify(executionFactory.createDaemon(deepEqual({ daemonModule: PythonDaemonModule, pythonPath: 'MY_PY' }))).twice();
    }).timeout(3_000);
    test('Changing interpreter without opening a notebook does not result in a daemon being created', async () => {
        // Trigger changes to interpreter.
        interpreterEventEmitter.fire();

        // Wait for deounce to complete.
        await sleep(1000);

        verify(interpreterService.getActiveInterpreter(anything())).never();
        verify(executionFactory.createDaemon(anything())).never();
    }).timeout(3_000);
});
