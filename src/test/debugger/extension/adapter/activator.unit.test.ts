// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
// tslint:disable-next-line: match-default-export-name
import rewiremock from 'rewiremock';
import { anything, instance, mock, spy, verify, when } from 'ts-mockito';
import { IExtensionSingleActivationService } from '../../../../client/activation/types';
import { ApplicationEnvironment } from '../../../../client/common/application/applicationEnvironment';
import { DebugService } from '../../../../client/common/application/debugService';
import { IDebugService } from '../../../../client/common/application/types';
import { WorkspaceService } from '../../../../client/common/application/workspace';
import { ConfigurationService } from '../../../../client/common/configuration/service';
import { CryptoUtils } from '../../../../client/common/crypto';
import { DebugAdapterDescriptorFactory as DebugAdapterExperiment } from '../../../../client/common/experimentGroups';
import { ExperimentsManager } from '../../../../client/common/experiments';
import { HttpClient } from '../../../../client/common/net/httpClient';
import { PersistentStateFactory } from '../../../../client/common/persistentState';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { IDisposableRegistry, IPythonSettings } from '../../../../client/common/types';
import { DebugAdapterActivator } from '../../../../client/debugger/extension/adapter/activator';
import { DebugAdapterDescriptorFactory } from '../../../../client/debugger/extension/adapter/factory';
import { DebugSessionLoggingFactory } from '../../../../client/debugger/extension/adapter/logging';
import { AttachProcessProviderFactory } from '../../../../client/debugger/extension/attachQuickPick/factory';
import { IAttachProcessProviderFactory } from '../../../../client/debugger/extension/attachQuickPick/types';
import { IDebugAdapterDescriptorFactory, IDebugSessionLoggingFactory } from '../../../../client/debugger/extension/types';
import { clearTelemetryReporter } from '../../../../client/telemetry';
import { EventName } from '../../../../client/telemetry/constants';
import { noop } from '../../../core';
import { MockOutputChannel } from '../../../mockClasses';

// tslint:disable-next-line: max-func-body-length
suite('Debugging - Adapter Factory and logger Registration', () => {
    const oldValueOfVSC_PYTHON_UNIT_TEST = process.env.VSC_PYTHON_UNIT_TEST;
    const oldValueOfVSC_PYTHON_CI_TEST = process.env.VSC_PYTHON_CI_TEST;
    let activator: IExtensionSingleActivationService;
    let debugService: IDebugService;
    let descriptorFactory: IDebugAdapterDescriptorFactory;
    let loggingFactory: IDebugSessionLoggingFactory;
    let disposableRegistry: IDisposableRegistry;
    let attachFactory: IAttachProcessProviderFactory;
    let experimentsManager: ExperimentsManager;
    let spiedInstance: ExperimentsManager;

    class Reporter {
        public static eventNames: string[] = [];
        public static properties: Record<string, string>[] = [];
        public static measures: {}[] = [];
        public sendTelemetryEvent(eventName: string, properties?: {}, measures?: {}) {
            Reporter.eventNames.push(eventName);
            Reporter.properties.push(properties!);
            Reporter.measures.push(measures!);
        }
    }

    setup(() => {
        const workspaceService = mock(WorkspaceService);
        const httpClient = mock(HttpClient);
        const crypto = mock(CryptoUtils);
        const appEnvironment = mock(ApplicationEnvironment);
        const persistentStateFactory = mock(PersistentStateFactory);
        const output = mock(MockOutputChannel);
        const configurationService = mock(ConfigurationService);
        const fs = mock(FileSystem);

        process.env.VSC_PYTHON_UNIT_TEST = undefined;
        process.env.VSC_PYTHON_CI_TEST = undefined;
        rewiremock.enable();
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        // tslint:disable-next-line: no-any
        when(configurationService.getSettings(undefined)).thenReturn(({ experiments: { enabled: true } } as any) as IPythonSettings);
        experimentsManager = new ExperimentsManager(
            instance(persistentStateFactory),
            instance(workspaceService),
            instance(httpClient),
            instance(crypto),
            instance(appEnvironment),
            instance(output),
            instance(fs),
            instance(configurationService)
        );
        spiedInstance = spy(experimentsManager);

        attachFactory = mock(AttachProcessProviderFactory);

        debugService = mock(DebugService);
        descriptorFactory = mock(DebugAdapterDescriptorFactory);
        loggingFactory = mock(DebugSessionLoggingFactory);
        disposableRegistry = [];
        activator = new DebugAdapterActivator(
            instance(debugService),
            instance(descriptorFactory),
            instance(loggingFactory),
            disposableRegistry,
            experimentsManager,
            instance(attachFactory)
        );
    });

    teardown(() => {
        process.env.VSC_PYTHON_UNIT_TEST = oldValueOfVSC_PYTHON_UNIT_TEST;
        process.env.VSC_PYTHON_CI_TEST = oldValueOfVSC_PYTHON_CI_TEST;
        Reporter.properties = [];
        Reporter.eventNames = [];
        Reporter.measures = [];
        rewiremock.disable();
        clearTelemetryReporter();
    });

    test('Register Adapter Factory if inside the DA experiment', async () => {
        when(spiedInstance.inExperiment(DebugAdapterExperiment.experiment)).thenReturn(true);

        await activator.activate();

        verify(debugService.registerDebugAdapterTrackerFactory('python', instance(loggingFactory))).once();
        verify(debugService.registerDebugAdapterDescriptorFactory('python', instance(descriptorFactory))).once();
    });

    test('Register a disposable item if inside the DA experiment', async () => {
        when(spiedInstance.inExperiment(DebugAdapterExperiment.experiment)).thenReturn(true);
        const disposable = { dispose: noop };
        when(debugService.registerDebugAdapterTrackerFactory(anything(), anything())).thenReturn(disposable);
        when(debugService.registerDebugAdapterDescriptorFactory(anything(), anything())).thenReturn(disposable);

        await activator.activate();

        assert.deepEqual(disposableRegistry, [disposable, disposable]);
    });

    test('Send experiment group telemetry if inside the DA experiment', async () => {
        when(spiedInstance.userExperiments).thenReturn([{ name: DebugAdapterExperiment.experiment, salt: DebugAdapterExperiment.experiment, min: 0, max: 0 }]);

        await activator.activate();

        assert.deepEqual(Reporter.eventNames, [EventName.PYTHON_EXPERIMENTS]);
        assert.deepEqual(Reporter.properties, [{ expName: DebugAdapterExperiment.experiment }]);
    });

    test("Don't register the Adapter Factory if not inside the DA experiment", async () => {
        when(spiedInstance.inExperiment(DebugAdapterExperiment.experiment)).thenReturn(false);

        await activator.activate();

        verify(debugService.registerDebugAdapterTrackerFactory('python', instance(loggingFactory))).never();
        verify(debugService.registerDebugAdapterDescriptorFactory('python', instance(descriptorFactory))).never();
    });

    test("Don't register a disposable item if not inside the DA experiment", async () => {
        when(spiedInstance.inExperiment(DebugAdapterExperiment.experiment)).thenReturn(false);

        await activator.activate();

        assert.deepEqual(disposableRegistry, []);
    });

    test('Send control group telemetry if inside the DA experiment control group', async () => {
        when(spiedInstance.userExperiments).thenReturn([{ name: DebugAdapterExperiment.control, salt: DebugAdapterExperiment.control, min: 0, max: 0 }]);

        await activator.activate();

        assert.deepEqual(Reporter.eventNames, [EventName.PYTHON_EXPERIMENTS]);
        assert.deepEqual(Reporter.properties, [{ expName: DebugAdapterExperiment.control }]);
    });

    test("Don't send any telemetry if not inside the DA experiment nor control group", async () => {
        when(spiedInstance.userExperiments).thenReturn([]);

        await activator.activate();

        assert.deepEqual(Reporter.eventNames, []);
        assert.deepEqual(Reporter.properties, []);
    });
});
