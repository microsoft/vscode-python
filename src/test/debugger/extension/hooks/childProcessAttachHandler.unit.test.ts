// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { ChildProcessAttachEventHandler } from '../../../../client/debugger/extension/hooks/childProcessAttachHandler';
import { ChildProcessAttachService } from '../../../../client/debugger/extension/hooks/childProcessAttachService';
import { PTVSDEvents } from '../../../../client/debugger/extension/hooks/constants';

suite('Debug - Child Process', () => {
    test('Do not attach to child process if event is invalid', async () => {
        const attachService = mock(ChildProcessAttachService);
        const handler = new ChildProcessAttachEventHandler(instance(attachService));
        const body: any = {};
        const session: any = {};
        await handler.handleCustomEvent({ event: 'abc', body, session });
        verify(attachService.attach(body, session)).never();
    });
    test('Do not attach to child process if event is invalid', async () => {
        const attachService = mock(ChildProcessAttachService);
        const handler = new ChildProcessAttachEventHandler(instance(attachService));
        const body: any = {};
        const session: any = {};
        await handler.handleCustomEvent({ event: PTVSDEvents.ChildProcessLaunched, body, session });
        verify(attachService.attach(body, session)).once();
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
        const session: any = {};
        when(attachService.attach(body, session)).thenThrow(new Error('Kaboom'));
        await handler.handleCustomEvent({ event: PTVSDEvents.ChildProcessLaunched, body, session: {} as any });
        verify(attachService.attach(body, anything())).once();
        const [, secondArg] = capture(attachService.attach).last();
        expect(secondArg).to.deep.equal(session);
    });
});
