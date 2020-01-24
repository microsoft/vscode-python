// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { IExtensionSingleActivationService } from '../../../client/activation/types';
import { PreWarmActivatedEnvironmentVariables } from '../../../client/interpreter/activation/preWarmVariables';
import { EnvironmentActivationService } from '../../../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';

suite('Interpreters Activation - Env Variables', () => {
    let activationService: IExtensionSingleActivationService;
    let envActivationService: IEnvironmentActivationService;
    setup(() => {
        envActivationService = mock(EnvironmentActivationService);
        activationService = new PreWarmActivatedEnvironmentVariables(instance(envActivationService));
    });
    test('Should pre-warm env variables', async () => {
        when(envActivationService.getActivatedEnvironmentVariables(anything())).thenResolve();

        await activationService.activate();

        verify(envActivationService.getActivatedEnvironmentVariables(undefined)).once();
    });
});
