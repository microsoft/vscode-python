// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { EventEmitter } from 'vscode';
import { IExtensionSingleActivationService } from '../../client/activation/types';
import { createDeferred } from '../../client/common/utils/async';
import { Architecture } from '../../client/common/utils/platform';
import { JupyterInterpreterService } from '../../client/datascience/jupyter/interpreter/jupyterInterpreterService';
import { PreWarmActivatedJupyterEnvironmentVariables } from '../../client/datascience/preWarmVariables';
import { EnvironmentActivationService } from '../../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../../client/interpreter/activation/types';
import { InterpreterType, PythonInterpreter } from '../../client/pythonEnvironments/info';
import { sleep } from '../core';

suite('DataScience - PreWarm Env Vars', () => {
    let activationService: IExtensionSingleActivationService;
    let envActivationService: IEnvironmentActivationService;
    let jupyterInterpreter: JupyterInterpreterService;
    let onDidChangeInterpreter: EventEmitter<PythonInterpreter>;
    let interpreter: PythonInterpreter;
    setup(() => {
        interpreter = {
            architecture: Architecture.Unknown,
            path: '',
            sysPrefix: '',
            sysVersion: '',
            type: InterpreterType.Conda
        };
        onDidChangeInterpreter = new EventEmitter<PythonInterpreter>();
        envActivationService = mock(EnvironmentActivationService);
        jupyterInterpreter = mock(JupyterInterpreterService);
        when(jupyterInterpreter.onDidChangeInterpreter).thenReturn(onDidChangeInterpreter.event);
        activationService = new PreWarmActivatedJupyterEnvironmentVariables(
            instance(envActivationService),
            instance(jupyterInterpreter),
            []
        );
    });
    test('Should not pre-warm env variables if there is no jupyter interpreter', async () => {
        const envActivated = createDeferred<string>();
        when(jupyterInterpreter.getSelectedInterpreter()).thenResolve(undefined);
        when(envActivationService.getActivatedEnvironmentVariables(anything(), anything())).thenCall(() => {
            envActivated.reject(new Error('Environment Activated when it should not have been!'));
            return Promise.resolve();
        });

        await activationService.activate();

        await Promise.race([envActivated.promise, sleep(50)]);
    });
    test('Should pre-warm env variables', async () => {
        const envActivated = createDeferred<string>();
        when(jupyterInterpreter.getSelectedInterpreter()).thenResolve(interpreter);
        when(envActivationService.getActivatedEnvironmentVariables(anything(), anything())).thenCall(() => {
            envActivated.resolve();
            return Promise.resolve();
        });

        await activationService.activate();

        await envActivated.promise;
        verify(envActivationService.getActivatedEnvironmentVariables(undefined, interpreter)).once();
    });
    test('Should pre-warm env variables when jupyter interpreter changes', async () => {
        const envActivated = createDeferred<string>();
        when(jupyterInterpreter.getSelectedInterpreter()).thenResolve(undefined);
        when(envActivationService.getActivatedEnvironmentVariables(anything(), anything())).thenCall(() => {
            envActivated.reject(new Error('Environment Activated when it should not have been!'));
            return Promise.resolve();
        });

        await activationService.activate();

        await Promise.race([envActivated.promise, sleep(50)]);

        // Change interpreter
        when(jupyterInterpreter.getSelectedInterpreter()).thenResolve(interpreter);
        when(envActivationService.getActivatedEnvironmentVariables(anything(), anything())).thenCall(() => {
            envActivated.resolve();
            return Promise.resolve();
        });
        onDidChangeInterpreter.fire(interpreter);

        await envActivated.promise;
        verify(envActivationService.getActivatedEnvironmentVariables(undefined, interpreter)).once();
    });
});
