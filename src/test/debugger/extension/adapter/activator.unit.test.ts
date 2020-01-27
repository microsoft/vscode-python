// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { IExtensionSingleActivationService } from '../../../../client/activation/types';
import { DebugService } from '../../../../client/common/application/debugService';
import { IDebugService } from '../../../../client/common/application/types';
import { ConfigurationService } from '../../../../client/common/configuration/service';
import { IDisposableRegistry, IPythonSettings } from '../../../../client/common/types';
import { DebugAdapterActivator } from '../../../../client/debugger/extension/adapter/activator';
import { DebugAdapterDescriptorFactory } from '../../../../client/debugger/extension/adapter/factory';
import { DebugSessionLoggingFactory } from '../../../../client/debugger/extension/adapter/logging';
import { AttachProcessProviderFactory } from '../../../../client/debugger/extension/attachQuickPick/factory';
import { IAttachProcessProviderFactory } from '../../../../client/debugger/extension/attachQuickPick/types';
import { IDebugAdapterDescriptorFactory, IDebugSessionLoggingFactory } from '../../../../client/debugger/extension/types';
import { clearTelemetryReporter } from '../../../../client/telemetry';
import { noop } from '../../../core';

// tslint:disable-next-line: max-func-body-length
suite('Debugging - Adapter Factory and logger Registration', () => {
    let activator: IExtensionSingleActivationService;
    let debugService: IDebugService;
    let descriptorFactory: IDebugAdapterDescriptorFactory;
    let loggingFactory: IDebugSessionLoggingFactory;
    let disposableRegistry: IDisposableRegistry;
    let attachFactory: IAttachProcessProviderFactory;

    setup(() => {
        const configurationService = mock(ConfigurationService);

        // tslint:disable-next-line: no-any
        when(configurationService.getSettings(undefined)).thenReturn(({ experiments: { enabled: true } } as any) as IPythonSettings);
        attachFactory = mock(AttachProcessProviderFactory);

        debugService = mock(DebugService);
        descriptorFactory = mock(DebugAdapterDescriptorFactory);
        loggingFactory = mock(DebugSessionLoggingFactory);
        disposableRegistry = [];
        activator = new DebugAdapterActivator(instance(debugService), instance(descriptorFactory), instance(loggingFactory), disposableRegistry, instance(attachFactory));
    });

    teardown(() => {
        clearTelemetryReporter();
    });

    test('Register Debug adapter factory', async () => {
        await activator.activate();

        verify(debugService.registerDebugAdapterTrackerFactory('python', instance(loggingFactory))).once();
        verify(debugService.registerDebugAdapterDescriptorFactory('python', instance(descriptorFactory))).once();
    });

    test('Register a disposable item', async () => {
        const disposable = { dispose: noop };
        when(debugService.registerDebugAdapterTrackerFactory(anything(), anything())).thenReturn(disposable);
        when(debugService.registerDebugAdapterDescriptorFactory(anything(), anything())).thenReturn(disposable);

        await activator.activate();

        assert.deepEqual(disposableRegistry, [disposable, disposable]);
    });
});
