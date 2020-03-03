// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { anyString, anything, instance, mock, spy, verify, when } from 'ts-mockito';
import { DebugSession, WorkspaceFolder } from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { ApplicationEnvironment } from '../../../../client/common/application/applicationEnvironment';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { IApplicationShell } from '../../../../client/common/application/types';
import { WorkspaceService } from '../../../../client/common/application/workspace';
import { ConfigurationService } from '../../../../client/common/configuration/service';
import { CryptoUtils } from '../../../../client/common/crypto';
import { DebugAdapterNewPtvsd } from '../../../../client/common/experimentGroups';
import { ExperimentsManager } from '../../../../client/common/experiments';
import { BrowserService } from '../../../../client/common/net/browser';
import { HttpClient } from '../../../../client/common/net/httpClient';
import { PersistentStateFactory } from '../../../../client/common/persistentState';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { IBrowserService, IPythonSettings } from '../../../../client/common/types';
import { createDeferred, sleep } from '../../../../client/common/utils/async';
import { Common } from '../../../../client/common/utils/localize';
import { OutdatedDebuggerPromptFactory } from '../../../../client/debugger/extension/adapter/outdatedDebuggerPrompt';
import { clearTelemetryReporter } from '../../../../client/telemetry';
import { MockOutputChannel } from '../../../mockClasses';

// tslint:disable-next-line: max-func-body-length
suite('Debugging - Outdated Debugger Prompt tests.', () => {
    let promptFactory: OutdatedDebuggerPromptFactory;
    let experimentsManager: ExperimentsManager;
    let spiedInstance: ExperimentsManager;
    let appShell: IApplicationShell;
    let browserService: IBrowserService;

    const ptvsdOutputEvent: DebugProtocol.OutputEvent = {
        seq: 1,
        type: 'event',
        event: 'output',
        body: { category: 'telemetry', output: 'ptvsd', data: { packageVersion: '4.3.2' } }
    };

    const debugpyOutputEvent: DebugProtocol.OutputEvent = {
        seq: 1,
        type: 'event',
        event: 'output',
        body: { category: 'telemetry', output: 'debugpy', data: { packageVersion: '1.0.0' } }
    };

    setup(() => {
        const workspaceService = mock(WorkspaceService);
        const httpClient = mock(HttpClient);
        const crypto = mock(CryptoUtils);
        const appEnvironment = mock(ApplicationEnvironment);
        const persistentStateFactory = mock(PersistentStateFactory);
        const output = mock(MockOutputChannel);
        const configurationService = mock(ConfigurationService);
        const fs = mock(FileSystem);
        when(configurationService.getSettings(undefined)).thenReturn(({
            experiments: { enabled: true }
            // tslint:disable-next-line: no-any
        } as any) as IPythonSettings);
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

        experimentsManager = mock(ExperimentsManager);
        appShell = mock(ApplicationShell);
        browserService = mock(BrowserService);
        promptFactory = new OutdatedDebuggerPromptFactory(
            experimentsManager,
            instance(appShell),
            instance(browserService)
        );
    });

    teardown(() => {
        clearTelemetryReporter();
    });

    function createSession(workspaceFolder?: WorkspaceFolder): DebugSession {
        return {
            configuration: {
                name: '',
                request: 'launch',
                type: 'python'
            },
            id: 'test1',
            name: 'python',
            type: 'python',
            workspaceFolder,
            customRequest: () => Promise.resolve()
        };
    }

    test('Show prompt when in new debugger experiment and using ptvsd, more info not clicked', async () => {
        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        when(appShell.showInformationMessage(anything(), anything())).thenReturn(Promise.resolve(undefined));

        const session = createSession();
        const prompter = await promptFactory.createDebugAdapterTracker(session);
        if (prompter) {
            prompter.onDidSendMessage!(ptvsdOutputEvent);
        }

        verify(browserService.launch(anyString())).never();
        // First call should show info once
        verify(appShell.showInformationMessage(anything(), anything())).once();
        assert(prompter);

        prompter!.onDidSendMessage!(ptvsdOutputEvent);
        // Can't use deferred promise here
        await sleep(1);

        verify(browserService.launch(anyString())).never();
        // Second time it should not be called, so overall count is one.
        verify(appShell.showInformationMessage(anything(), anything())).once();
    });

    test('Show prompt when in new debugger experiment and using ptvsd, more info clicked', async () => {
        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        when(appShell.showInformationMessage(anything(), anything())).thenReturn(Promise.resolve(Common.moreInfo()));
        const deferred = createDeferred();
        when(browserService.launch(anything())).thenCall(() => deferred.resolve());

        const session = createSession();
        const prompter = await promptFactory.createDebugAdapterTracker(session);
        assert(prompter);

        prompter!.onDidSendMessage!(ptvsdOutputEvent);
        await deferred.promise;

        verify(browserService.launch(anything())).once();
        // First call should show info once
        verify(appShell.showInformationMessage(anything(), anything())).once();

        prompter!.onDidSendMessage!(ptvsdOutputEvent);
        // The second call does not go through the same path. So we just give enough time for the
        // operation to complete.
        await sleep(1);

        verify(browserService.launch(anyString())).once();
        // Second time it should not be called, so overall count is one.
        verify(appShell.showInformationMessage(anything(), anything())).once();
    });

    test("Don't show prompt when in new debugger experiment and using debugpy", async () => {
        when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
        when(appShell.showInformationMessage(anything(), anything())).thenReturn(Promise.resolve(undefined));

        const session = createSession();
        const prompter = await promptFactory.createDebugAdapterTracker(session);
        assert(prompter);

        prompter!.onDidSendMessage!(debugpyOutputEvent);
        // Can't use deferred promise here
        await sleep(1);

        verify(appShell.showInformationMessage(anything(), anything())).never();
    });

    const someRequest: DebugProtocol.RunInTerminalRequest = {
        seq: 1,
        type: 'request',
        command: 'runInTerminal',
        arguments: {
            cwd: '',
            args: ['']
        }
    };
    const someEvent: DebugProtocol.ContinuedEvent = {
        seq: 1,
        type: 'event',
        event: 'continued',
        body: { threadId: 1, allThreadsContinued: true }
    };
    // Notice that this is stdout, not telemetry event.
    const someOutputEvent: DebugProtocol.OutputEvent = {
        seq: 1,
        type: 'event',
        event: 'output',
        body: { category: 'stdout', output: 'ptvsd' }
    };

    [someRequest, someEvent, someOutputEvent].forEach(message => {
        test(`Don't show prompt when in new debugger experiment and debugger telemetry event: ${JSON.stringify(
            message
        )}`, async () => {
            when(spiedInstance.inExperiment(DebugAdapterNewPtvsd.experiment)).thenReturn(true);
            when(appShell.showInformationMessage(anything(), anything())).thenReturn(Promise.resolve(undefined));

            const session = createSession();
            const prompter = await promptFactory.createDebugAdapterTracker(session);
            assert(prompter);

            prompter!.onDidSendMessage!(message);
            // Can't use deferred promise here
            await sleep(1);

            verify(appShell.showInformationMessage(anything(), anything())).never();
        });
    });
});
