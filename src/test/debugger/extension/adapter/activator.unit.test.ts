// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { IExtensionSingleActivationService } from '../../../../client/activation/types';
import { CommandManager } from '../../../../client/common/application/commandManager';
import { DebugService } from '../../../../client/common/application/debugService';
import { ICommandManager, IDebugService } from '../../../../client/common/application/types';
import { ConfigurationService } from '../../../../client/common/configuration/service';
import { IConfigurationService, IDisposableRegistry, IPythonSettings } from '../../../../client/common/types';
import { DebugAdapterActivator } from '../../../../client/debugger/extension/adapter/activator';
import { DebugAdapterDescriptorFactory } from '../../../../client/debugger/extension/adapter/factory';
import { DebugSessionLoggingFactory } from '../../../../client/debugger/extension/adapter/logging';
import { OutdatedDebuggerPromptFactory } from '../../../../client/debugger/extension/adapter/outdatedDebuggerPrompt';
import { AttachProcessProviderFactory } from '../../../../client/debugger/extension/attachQuickPick/factory';
import { IAttachProcessProviderFactory } from '../../../../client/debugger/extension/attachQuickPick/types';
import {
    IDebugAdapterDescriptorFactory,
    IDebugSessionLoggingFactory,
    IOutdatedDebuggerPromptFactory,
} from '../../../../client/debugger/extension/types';
import { clearTelemetryReporter } from '../../../../client/telemetry';
import { noop } from '../../../core';

suite('Debugging - Adapter Factory and logger Registration', () => {
    let activator: IExtensionSingleActivationService;
    let debugService: IDebugService;
    let commandManager: ICommandManager;
    let descriptorFactory: IDebugAdapterDescriptorFactory;
    let loggingFactory: IDebugSessionLoggingFactory;
    let debuggerPromptFactory: IOutdatedDebuggerPromptFactory;
    let disposableRegistry: IDisposableRegistry;
    let attachFactory: IAttachProcessProviderFactory;
    let configService: IConfigurationService;

    setup(() => {
        attachFactory = mock(AttachProcessProviderFactory);

        debugService = mock(DebugService);
        when(debugService.onDidStartDebugSession).thenReturn(() => noop as any);

        commandManager = mock(CommandManager);

        configService = mock(ConfigurationService);
        when(configService.getSettings(undefined)).thenReturn(({
            experiments: { enabled: true },
        } as any) as IPythonSettings);

        descriptorFactory = mock(DebugAdapterDescriptorFactory);
        loggingFactory = mock(DebugSessionLoggingFactory);
        debuggerPromptFactory = mock(OutdatedDebuggerPromptFactory);
        disposableRegistry = [];

        activator = new DebugAdapterActivator(
            instance(debugService),
            instance(configService),
            instance(commandManager),
            instance(descriptorFactory),
            instance(loggingFactory),
            instance(debuggerPromptFactory),
            disposableRegistry,
            instance(attachFactory),
        );
    });

    teardown(() => {
        clearTelemetryReporter();
    });

    test('Register Debug adapter factory', async () => {
        await activator.activate();

        verify(debugService.registerDebugAdapterTrackerFactory('python', instance(loggingFactory))).once();
        verify(debugService.registerDebugAdapterTrackerFactory('python', instance(debuggerPromptFactory))).once();
        verify(debugService.registerDebugAdapterDescriptorFactory('python', instance(descriptorFactory))).once();
    });

    test('Register a disposable item', async () => {
        const disposable = { dispose: noop };
        when(debugService.registerDebugAdapterTrackerFactory(anything(), anything())).thenReturn(disposable);
        when(debugService.registerDebugAdapterDescriptorFactory(anything(), anything())).thenReturn(disposable);
        when(debugService.onDidStartDebugSession).thenReturn(() => disposable);

        await activator.activate();

        assert.deepEqual(disposableRegistry, [disposable, disposable, disposable, disposable]);
    });
});
