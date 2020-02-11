// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Disposable } from 'vscode';
import { IExtensionSingleActivationService } from '../../../../client/activation/types';
import { CommandManager } from '../../../../client/common/application/commandManager';
import { ICommandManager } from '../../../../client/common/application/types';
import { IDisposableRegistry } from '../../../../client/common/types';
import { JupyterInterpreterSelectionCommand } from '../../../../client/datascience/jupyter/interpreter/jupyterInterpreterSelectionCommand';
import { JupyterInterpreterService } from '../../../../client/datascience/jupyter/interpreter/jupyterInterpreterService';

suite('Data Science - Jupyter Interpreter Command', () => {
    let interpreterCommand: IExtensionSingleActivationService;
    let disposableRegistry: IDisposableRegistry;
    let commandManager: ICommandManager;
    let interpreterService: JupyterInterpreterService;
    setup(() => {
        interpreterService = mock(JupyterInterpreterService);
        commandManager = mock(CommandManager);
        disposableRegistry = [];
        when(interpreterService.selectInterpreter()).thenResolve();
        interpreterCommand = new JupyterInterpreterSelectionCommand(
            instance(interpreterService),
            instance(commandManager),
            disposableRegistry
        );
    });
    test('Activation should register command', async () => {
        const disposable = mock(Disposable);
        when(commandManager.registerCommand('python.datascience.selectJupyterInterpreter', anything())).thenReturn(
            instance(disposable)
        );

        await interpreterCommand.activate();

        verify(commandManager.registerCommand('python.datascience.selectJupyterInterpreter', anything())).once();
    });
    test('Command handler must be jupyter interpreter selection', async () => {
        const disposable = mock(Disposable);
        let handler: Function | undefined;
        when(commandManager.registerCommand('python.datascience.selectJupyterInterpreter', anything())).thenCall(
            (_, cb: Function) => {
                handler = cb;
                return instance(disposable);
            }
        );

        await interpreterCommand.activate();

        verify(commandManager.registerCommand('python.datascience.selectJupyterInterpreter', anything())).once();
        assert.isFunction(handler);

        // Invoking handler must select jupyter interpreter.
        handler!();

        verify(interpreterService.selectInterpreter()).once();
    });
});
