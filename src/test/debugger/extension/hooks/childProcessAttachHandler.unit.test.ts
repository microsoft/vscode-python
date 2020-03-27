// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { ChildProcessAttachEventHandler } from '../../../../client/debugger/extension/hooks/childProcessAttachHandler';
import { ChildProcessAttachService } from '../../../../client/debugger/extension/hooks/childProcessAttachService';
import { DebuggerEvents } from '../../../../client/debugger/extension/hooks/constants';
import { ChildProcessLaunchData } from '../../../../client/debugger/extension/hooks/types';

suite('Debug - Child Process', () => {
    test('Do not attach if the event is undefined', async () => {
        const attachService = mock(ChildProcessAttachService);
        const handler = new ChildProcessAttachEventHandler(instance(attachService));
        await handler.handleCustomEvent(undefined as any);
        verify(attachService.attach(anything(), anything())).never();
    });
    test('Do not attach to child process if event is invalid', async () => {
        const attachService = mock(ChildProcessAttachService);
        const handler = new ChildProcessAttachEventHandler(instance(attachService));
        const body: any = {};
        const session: any = {};
        await handler.handleCustomEvent({ event: 'abc', body, session });
        verify(attachService.attach(body, session)).never();
    });
    test('Do not attach to child process if ptvsd_subprocess event is invalid', async () => {
        const attachService = mock(ChildProcessAttachService);
        const handler = new ChildProcessAttachEventHandler(instance(attachService));
        const body: any = {};
        const session: any = {};
        await handler.handleCustomEvent({ event: DebuggerEvents.ChildProcessLaunched, body, session });
        verify(attachService.attach(body, session)).never();
    });
    test('Do not attach to child process if ptvsd_attach event is invalid', async () => {
        const attachService = mock(ChildProcessAttachService);
        const handler = new ChildProcessAttachEventHandler(instance(attachService));
        const body: any = {};
        const session: any = {};
        await handler.handleCustomEvent({ event: DebuggerEvents.PtvsdAttachToSubprocess, body, session });
        verify(attachService.attach(body, session)).never();
    });
    test('Do not attach to child process if debugpy_attach event is invalid', async () => {
        const attachService = mock(ChildProcessAttachService);
        const handler = new ChildProcessAttachEventHandler(instance(attachService));
        const body: any = {};
        const session: any = {};
        await handler.handleCustomEvent({ event: DebuggerEvents.DebugpyAttachToSubprocess, body, session });
        verify(attachService.attach(body, session)).never();
    });
    test('Exceptions are not bubbled up if exceptions are thrown', async () => {
        const attachService = mock(ChildProcessAttachService);
        const handler = new ChildProcessAttachEventHandler(instance(attachService));
        const body: ChildProcessLaunchData = {
            rootProcessId: 0,
            parentProcessId: 0,
            processId: 0,
            port: 0,
            rootStartRequest: {
                arguments: {
                    type: 'python',
                    name: '',
                    request: 'attach'
                },
                command: 'attach',
                seq: 0,
                type: 'python'
            }
        };
        const session: any = {};
        when(attachService.attach(body, session)).thenThrow(new Error('Kaboom'));
        await handler.handleCustomEvent({ event: DebuggerEvents.ChildProcessLaunched, body, session: {} as any });
        verify(attachService.attach(body, anything())).once();
        const [, secondArg] = capture(attachService.attach).last();
        expect(secondArg).to.deep.equal(session);
    });
});
