// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { EventEmitter } from 'vscode';
import { IExtensionSingleActivationService } from '../../../client/activation/types';
import { PreWarmActivatedEnvironmentVariables } from '../../../client/interpreter/activation/preWarmVariables';
import { EnvironmentActivationService } from '../../../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';

suite('Interpreters Activation - Env Variables', () => {
    let activationService: IExtensionSingleActivationService;
    let envActivationService: IEnvironmentActivationService;
    let interpreterService: IInterpreterService;
    let onDidChangeInterpreter: EventEmitter<void>;
    setup(() => {
        onDidChangeInterpreter = new EventEmitter<void>();
        envActivationService = mock(EnvironmentActivationService);
        interpreterService = mock(InterpreterService);
        when(interpreterService.onDidChangeInterpreter).thenReturn(onDidChangeInterpreter.event);
        activationService = new PreWarmActivatedEnvironmentVariables(
            instance(envActivationService),
            instance(interpreterService)
        );
    });
    test('Should pre-warm env variables', async () => {
        when(envActivationService.getActivatedEnvironmentVariables(anything())).thenResolve();

        await activationService.activate();

        verify(envActivationService.getActivatedEnvironmentVariables(undefined)).once();
    });
    test('Should pre-warm env variables when interpreter changes', async () => {
        when(envActivationService.getActivatedEnvironmentVariables(anything())).thenResolve();

        await activationService.activate();

        verify(envActivationService.getActivatedEnvironmentVariables(undefined)).once();

        onDidChangeInterpreter.fire();

        verify(envActivationService.getActivatedEnvironmentVariables(undefined)).twice();
    });
});
