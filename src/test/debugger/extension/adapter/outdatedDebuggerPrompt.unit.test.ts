// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { anyString, anything, instance, mock, verify, when } from 'ts-mockito';
import { DebugSession, WorkspaceFolder } from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { IApplicationShell } from '../../../../client/common/application/types';
import { ConfigurationService } from '../../../../client/common/configuration/service';
import { BrowserService } from '../../../../client/common/net/browser';
import { IBrowserService, IPythonSettings } from '../../../../client/common/types';
import { createDeferred, sleep } from '../../../../client/common/utils/async';
import { Common } from '../../../../client/common/utils/localize';
import { OutdatedDebuggerPromptFactory } from '../../../../client/debugger/extension/adapter/outdatedDebuggerPrompt';
import { clearTelemetryReporter } from '../../../../client/telemetry';

suite('Debugging - Outdated Debugger Prompt tests.', () => {
    let promptFactory: OutdatedDebuggerPromptFactory;
    let appShell: IApplicationShell;
    let browserService: IBrowserService;

    const ptvsdOutputEvent: DebugProtocol.OutputEvent = {
        seq: 1,
        type: 'event',
        event: 'output',
        body: { category: 'telemetry', output: 'ptvsd', data: { packageVersion: '4.3.2' } },
    };

    const debugpyOutputEvent: DebugProtocol.OutputEvent = {
        seq: 1,
        type: 'event',
        event: 'output',
        body: { category: 'telemetry', output: 'debugpy', data: { packageVersion: '1.0.0' } },
    };

    setup(() => {
        const configurationService = mock(ConfigurationService);
        when(configurationService.getSettings(undefined)).thenReturn(({
            experiments: { enabled: true },
        } as any) as IPythonSettings);

        appShell = mock(ApplicationShell);
        browserService = mock(BrowserService);
        promptFactory = new OutdatedDebuggerPromptFactory(instance(appShell), instance(browserService));
    });

    teardown(() => {
        clearTelemetryReporter();
    });

    function createSession(workspaceFolder?: WorkspaceFolder): DebugSession {
        return {
            configuration: {
                name: '',
                request: 'launch',
                type: 'python',
            },
            id: 'test1',
            name: 'python',
            type: 'python',
            workspaceFolder,
            customRequest: () => Promise.resolve(),
            getDebugProtocolBreakpoint: () => Promise.resolve(undefined),
        };
    }

    test('Show prompt when attaching to ptvsd, more info is NOT clicked', async () => {
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

    test('Show prompt when attaching to ptvsd, more info is clicked', async () => {
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

    test("Don't show prompt attaching to debugpy", async () => {
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
            args: [''],
        },
    };
    const someEvent: DebugProtocol.ContinuedEvent = {
        seq: 1,
        type: 'event',
        event: 'continued',
        body: { threadId: 1, allThreadsContinued: true },
    };
    // Notice that this is stdout, not telemetry event.
    const someOutputEvent: DebugProtocol.OutputEvent = {
        seq: 1,
        type: 'event',
        event: 'output',
        body: { category: 'stdout', output: 'ptvsd' },
    };

    [someRequest, someEvent, someOutputEvent].forEach((message) => {
        test(`Don't show prompt when non-telemetry events are seen: ${JSON.stringify(message)}`, async () => {
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
