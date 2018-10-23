// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { instance, mock, verify, when } from 'ts-mockito';
import { ChildProcessAttachEventHandler } from '../../../../client/debugger/extension/hooks/childProcessAttachHandler';
import { ChildProcessAttachService } from '../../../../client/debugger/extension/hooks/childProcessAttachService';
import { PTVSDEvents } from '../../../../client/debugger/extension/hooks/constants';

suite('Debugy - Child Process', () => {
    test('Do not attach to child process if event is invalid', async () => {
        const attachService = mock(ChildProcessAttachService);
        const handler = new ChildProcessAttachEventHandler(instance(attachService));
        const body: any = {};
        await handler.handleCustomEvent({ event: PTVSDEvents.ProcessLaunched, body, session: {} as any });
        verify(attachService.attach(body)).never();
    });
    test('Do not attach to child process if event is invalid', async () => {
        const attachService = mock(ChildProcessAttachService);
        const handler = new ChildProcessAttachEventHandler(instance(attachService));
        const body: any = {};
        await handler.handleCustomEvent({ event: PTVSDEvents.ChildProcessLaunched, body, session: {} as any });
        verify(attachService.attach(body)).once();
    });
    test('Exceptions are not bubbled up if data is invalid', async () => {
        const attachService = mock(ChildProcessAttachService);
        const handler = new ChildProcessAttachEventHandler(instance(attachService));
        await handler.handleCustomEvent(undefined as any);
    });
    test('Exceptions are not bubbled up if exceptions are thrown', async () => {
        const attachService = mock(ChildProcessAttachService);
        const handler = new ChildProcessAttachEventHandler(instance(attachService));
        const body: any = {};
        when(attachService.attach(body)).thenThrow(new Error('Kaboom'));
        await handler.handleCustomEvent({ event: PTVSDEvents.ChildProcessLaunched, body, session: {} as any });
        verify(attachService.attach(body)).once();
    });
});
