// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { IExtensionSingleActivationService } from '../../../../client/activation/types';
import { DebugService } from '../../../../client/common/application/debugService';
import { IDebugService } from '../../../../client/common/application/types';
import { DebugAdapterDescriptorFactory as DebugAdapterExperiment } from '../../../../client/common/experimentGroups';
import { ExperimentsManager } from '../../../../client/common/experiments';
import { IDisposableRegistry, IExperimentsManager } from '../../../../client/common/types';
import { DebugAdapterActivator } from '../../../../client/debugger/extension/adapter/activator';
import { DebugAdapterDescriptorFactory } from '../../../../client/debugger/extension/adapter/factory';
import { IDebugAdapterDescriptorFactory } from '../../../../client/debugger/extension/types';
import { noop } from '../../../core';

suite('Debugging - Adapter Factory Registration', () => {
    let activator: IExtensionSingleActivationService;
    let debugService: IDebugService;
    let factory: IDebugAdapterDescriptorFactory;
    let disposableRegistry: IDisposableRegistry;
    let experimentsManager: IExperimentsManager;
    setup(() => {
        debugService = mock(DebugService);
        factory = mock(DebugAdapterDescriptorFactory);
        experimentsManager = mock(ExperimentsManager);
        disposableRegistry = [];
        activator = new DebugAdapterActivator(instance(debugService), instance(factory), disposableRegistry, instance(experimentsManager));
    });
    test('Register Adapter Factory if inside the DA experiment', async () => {
        when(experimentsManager.inExperiment(DebugAdapterExperiment.experiment)).thenReturn(true);

        await activator.activate();

        verify(debugService.registerDebugAdapterDescriptorFactory('python', instance(factory))).once();
    });
    test('Register a disposable item if inside the DA experiment', async () => {
        when(experimentsManager.inExperiment(DebugAdapterExperiment.experiment)).thenReturn(true);
        const disposable = { dispose: noop };
        when(debugService.registerDebugAdapterDescriptorFactory(anything(), anything())).thenReturn(disposable);

        await activator.activate();

        assert.deepEqual(disposableRegistry, [disposable]);
    });
    test('Don\'t register the Adapter Factory if not inside the DA experiment', async () => {
        when(experimentsManager.inExperiment(DebugAdapterExperiment.experiment)).thenReturn(false);

        await activator.activate();

        verify(debugService.registerDebugAdapterDescriptorFactory('python', instance(factory))).never();
    });
    test('Don\'t register a disposable item if not inside the DA experiment', async () => {
        when(experimentsManager.inExperiment(DebugAdapterExperiment.experiment)).thenReturn(false);

        await activator.activate();

        assert.deepEqual(disposableRegistry, []);
    });
});
