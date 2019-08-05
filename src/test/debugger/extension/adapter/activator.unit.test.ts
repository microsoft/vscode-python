// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { IExtensionSingleActivationService } from '../../../../client/activation/types';
import { DebugService } from '../../../../client/common/application/debugService';
import { IDebugService } from '../../../../client/common/application/types';
import { IDisposableRegistry } from '../../../../client/common/types';
import { DebugAdapterActivator } from '../../../../client/debugger/extension/adapter/activator';
import { DebugAdapterDescriptorFactory } from '../../../../client/debugger/extension/adapter/factory';
import { noop } from '../../../core';

suite('Debugging - Adapter Factory Registration', () => {
    let activator: IExtensionSingleActivationService;
    let debugService: IDebugService;
    let factory: DebugAdapterDescriptorFactory;
    let disposableRegistry: IDisposableRegistry;
    setup(() => {
        debugService = mock(DebugService);
        factory = mock(DebugAdapterDescriptorFactory);
        disposableRegistry = [];
        activator = new DebugAdapterActivator(instance(debugService), instance(factory), disposableRegistry);
    });
    test('Register Adapter Factory', async () => {
        await activator.activate();

        verify(debugService.registerDebugAdapterDescriptorFactory('python', instance(factory))).once();
    });
    test('Register a disposable item', async () => {
        const disposable = { dispose: noop };
        when(debugService.registerDebugAdapterDescriptorFactory(anything(), anything())).thenReturn(disposable);

        await activator.activate();

        assert.deepEqual(disposableRegistry, [disposable]);
    });
});
