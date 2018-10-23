// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length max-classes-per-file

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { DebugSession, DebugSessionCustomEvent, Disposable } from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { noop } from '../../../../client/common/utils/misc';
import { PTVSDEvents } from '../../../../client/debugger/extension/hooks/constants';
import { ProcessTerminationEventHandler } from '../../../../client/debugger/extension/hooks/processTerminationHandler';
import { ProcessTerminationService } from '../../../../client/debugger/extension/hooks/processTerminationService';
import { ChildProcessLaunchData } from '../../../../client/debugger/extension/hooks/types';
import { AttachRequestArguments, LaunchRequestArguments } from '../../../../client/debugger/types';

suite('Debugy - Process Termination Handler', () => {
    test('Exceptions are not bubbled up if exceptions are thrown', async () => {
        const procTerminationService = mock(ProcessTerminationService);
        const handler = new ProcessTerminationEventHandler(instance(procTerminationService));
        const event: DebugProtocol.ProcessEvent = {
            event: PTVSDEvents.ProcessLaunched,
            type: '',
            seq: 1,
            body: {
                systemProcessId: 1,
                name: '',
                startMethod: 'launch'
            }
        } as any;
        const session = {
            id: '1234'
        };
        (event as any).session = session;

        when(procTerminationService.trackProcess(event.body.systemProcessId)).thenThrow(new Error('Kaboom'));
        await handler.handleCustomEvent(event as any);
        verify(procTerminationService.trackProcess(event.body.systemProcessId)).once();
    });
    test('Track child processes where main process was launched', async () => {
        const procTerminationService = mock(ProcessTerminationService);
        const handler = new ProcessTerminationEventHandler(instance(procTerminationService));

        const args: LaunchRequestArguments | AttachRequestArguments = {
            request: 'launch',
            type: 'python',
            name: ''
        };
        const body: ChildProcessLaunchData = {
            rootProcessId: 1,
            parentProcessId: 1,
            port: 1234,
            processId: 2,
            rootStartRequest: {
                seq: 1,
                type: 'python',
                arguments: args,
                command: 'request'
            }
        };
        const event: DebugSessionCustomEvent = {
            event: PTVSDEvents.ChildProcessLaunched,
            session: {} as any,
            body
        };
        await handler.handleCustomEvent(event as any);
        verify(procTerminationService.trackProcess(body.processId, body.parentProcessId)).twice();
    });
    test('Track child processes where main process was launched', async () => {
        const procTerminationService = mock(ProcessTerminationService);
        const handler = new ProcessTerminationEventHandler(instance(procTerminationService));

        const args: LaunchRequestArguments | AttachRequestArguments = {
            request: 'launch',
            type: 'python',
            name: ''
        };
        const body: ChildProcessLaunchData = {
            rootProcessId: 1,
            parentProcessId: 1,
            port: 1234,
            processId: 2,
            rootStartRequest: {
                seq: 1,
                type: 'python',
                arguments: args,
                command: 'request'
            }
        };
        const event: DebugSessionCustomEvent = {
            event: PTVSDEvents.ChildProcessLaunched,
            session: {} as any,
            body
        };
        await handler.handleCustomEvent(event as any);
        verify(procTerminationService.trackProcess(body.processId, body.parentProcessId)).atLeast(1);
    });
    test('Do not Track child processes where main process was attached to', async () => {
        const procTerminationService = mock(ProcessTerminationService);
        const handler = new ProcessTerminationEventHandler(instance(procTerminationService));

        const args: LaunchRequestArguments | AttachRequestArguments = {
            request: 'attach',
            type: 'python',
            name: ''
        };
        const body: ChildProcessLaunchData = {
            rootProcessId: 1,
            parentProcessId: 1,
            port: 1234,
            processId: 2,
            rootStartRequest: {
                seq: 1,
                type: 'python',
                arguments: args,
                command: 'request'
            }
        };
        const event: DebugSessionCustomEvent = {
            event: PTVSDEvents.ChildProcessLaunched,
            session: {} as any,
            body
        };
        await handler.handleCustomEvent(event as any);
        verify(procTerminationService.trackProcess(anything(), anything())).never();
    });
    test('Track child processes where main process was launched, and parent and root differ', async () => {
        const procTerminationService = mock(ProcessTerminationService);
        const handler = new ProcessTerminationEventHandler(instance(procTerminationService));

        const args: LaunchRequestArguments | AttachRequestArguments = {
            request: 'launch',
            type: 'python',
            name: ''
        };
        const body: ChildProcessLaunchData = {
            rootProcessId: 1,
            parentProcessId: 2,
            port: 1234,
            processId: 3,
            rootStartRequest: {
                seq: 1,
                type: 'python',
                arguments: args,
                command: 'request'
            }
        };
        const event: DebugSessionCustomEvent = {
            event: PTVSDEvents.ChildProcessLaunched,
            session: {} as any,
            body
        };
        await handler.handleCustomEvent(event as any);
        verify(procTerminationService.trackProcess(body.processId, body.parentProcessId)).once();
        verify(procTerminationService.trackProcess(body.processId, body.rootProcessId)).once();
    });
    test('Track processes launched', async () => {
        const procTerminationService = mock(ProcessTerminationService);
        const handler = new ProcessTerminationEventHandler(instance(procTerminationService));
        const event: DebugProtocol.ProcessEvent = {
            event: PTVSDEvents.ProcessLaunched,
            body: {
                name: '',
                startMethod: 'launch',
                systemProcessId: 1
            },
            seq: 1,
            type: 'python'
        };
        const session = {
            id: '1234'
        };
        (event as any).session = session;

        await handler.handleCustomEvent(event as any);
        verify(procTerminationService.trackProcess(event.body.systemProcessId)).once();
    });
    test('Do not Track processes attached', async () => {
        const procTerminationService = mock(ProcessTerminationService);
        const handler = new ProcessTerminationEventHandler(instance(procTerminationService));
        const event: DebugProtocol.ProcessEvent = {
            event: PTVSDEvents.ProcessLaunched,
            body: {
                name: '',
                startMethod: 'attach',
                systemProcessId: 1
            },
            seq: 1,
            type: 'python'
        };
        await handler.handleCustomEvent(event as any);
        verify(procTerminationService.trackProcess(anything())).never();
    });
    test('Handle termination', async () => {
        const procTerminationService = mock(ProcessTerminationService);
        const handler = new class extends ProcessTerminationEventHandler {
            protected async waitForCleanup() { noop(); }
        }(instance(procTerminationService));
        await handler.handleTerminateEvent({ name: '', type: '', id: '' } as any as DebugSession);
        verify(procTerminationService.terminateOrphanedProcesses()).once();
    });
    test('Handle termination of child process that was attached to as part of multi-proc debugging', async () => {
        const procTerminationService = mock(ProcessTerminationService);
        const handler = new class extends ProcessTerminationEventHandler {
            protected async waitForCleanup() { noop(); }
        }(instance(procTerminationService));

        const childProcessId = 2;

        const args: LaunchRequestArguments | AttachRequestArguments = {
            request: 'launch',
            type: 'python',
            name: ''
        };
        const body: ChildProcessLaunchData = {
            rootProcessId: 1,
            parentProcessId: 1,
            port: 1234,
            processId: childProcessId,
            rootStartRequest: {
                seq: 1,
                type: 'python',
                arguments: args,
                command: 'request'
            }
        };
        const event: DebugSessionCustomEvent = {
            event: PTVSDEvents.ChildProcessLaunched,
            session: {} as any,
            body
        };

        const session: DebugSession = {
            name: '',
            type: '',
            id: '9989098080'
        } as any;
        const processEvent: DebugProtocol.ProcessEvent = {
            body: {
                name: '',
                systemProcessId: childProcessId,
                startMethod: 'attach'
            },
            event: PTVSDEvents.ProcessLaunched,
            seq: 1,
            type: ''
        };
        (processEvent as any).session = session;

        // Handle event to attach to child process.
        await handler.handleCustomEvent(event);
        // Handle event for when `process` event has been created for above child process.
        await handler.handleCustomEvent(processEvent as any as DebugSessionCustomEvent);
        // Handle event for when debug session related to child process has terminated.
        await handler.handleTerminateEvent(session);

        verify(procTerminationService.terminateOrphanedProcesses()).once();
        verify(procTerminationService.terminateProcess(body.processId)).once();
    });
    test('Ensure child process does not terminate when parent process was attached to', async () => {
        const procTerminationService = mock(ProcessTerminationService);
        const handler = new class extends ProcessTerminationEventHandler {
            protected async waitForCleanup() { noop(); }
        }(instance(procTerminationService));

        const childProcessId = 2;

        const args: LaunchRequestArguments | AttachRequestArguments = {
            request: 'attach',
            type: 'python',
            name: ''
        };
        const body: ChildProcessLaunchData = {
            rootProcessId: 1,
            parentProcessId: 1,
            port: 1234,
            processId: childProcessId,
            rootStartRequest: {
                seq: 1,
                type: 'python',
                arguments: args,
                command: 'request'
            }
        };
        const event: DebugSessionCustomEvent = {
            event: PTVSDEvents.ChildProcessLaunched,
            session: {} as any,
            body
        };

        const session: DebugSession = {
            name: '',
            type: '',
            id: '9989098080'
        } as any;
        const processEvent: DebugProtocol.ProcessEvent = {
            body: {
                name: '',
                systemProcessId: childProcessId,
                startMethod: 'attach'
            },
            event: PTVSDEvents.ProcessLaunched,
            seq: 1,
            type: ''
        };
        (processEvent as any).session = session;

        // Handle event to attach to child process.
        await handler.handleCustomEvent(event);
        // Handle event for when `process` event has been created for above child process.
        await handler.handleCustomEvent(processEvent as any as DebugSessionCustomEvent);
        // Handle event for when debug session related to child process has terminated.
        await handler.handleTerminateEvent(session);

        verify(procTerminationService.terminateOrphanedProcesses()).once();
        verify(procTerminationService.terminateProcess(body.processId)).never();
    });
    test('Handle termination of process that was launched', async () => {
        const procTerminationService = mock(ProcessTerminationService);
        const handler = new class extends ProcessTerminationEventHandler {
            protected async waitForCleanup() { noop(); }
        }(instance(procTerminationService));

        const processId = 2;
        const session: DebugSession = {
            name: '',
            type: '',
            id: '9989098080'
        } as any;
        const processEvent: DebugProtocol.ProcessEvent = {
            body: {
                name: '',
                systemProcessId: processId,
                startMethod: 'launch'
            },
            event: PTVSDEvents.ProcessLaunched,
            seq: 1,
            type: ''
        };
        (processEvent as any).session = session;

        // Handle event for when process created via a launch of a debugger.
        await handler.handleCustomEvent(processEvent as any as DebugSessionCustomEvent);
        // Handle event for when debug session related to above process has terminated.
        await handler.handleTerminateEvent(session);

        verify(procTerminationService.terminateOrphanedProcesses()).once();
        verify(procTerminationService.terminateProcess(processId)).once();
    });
    test('Ensure process launched is not terminated when another debugger ends', async () => {
        const procTerminationService = mock(ProcessTerminationService);
        const handler = new class extends ProcessTerminationEventHandler {
            protected async waitForCleanup() { noop(); }
        }(instance(procTerminationService));

        const processId = 2;
        const session: DebugSession = {
            name: '',
            type: '',
            id: '9989098080'
        } as any;
        const processEvent: DebugProtocol.ProcessEvent = {
            body: {
                name: '',
                systemProcessId: processId,
                startMethod: 'launch'
            },
            event: PTVSDEvents.ProcessLaunched,
            seq: 1,
            type: ''
        };
        (processEvent as any).session = session;

        // Handle event for when process created via a launch of a debugger.
        await handler.handleCustomEvent(processEvent as any as DebugSessionCustomEvent);
        // Handle event for another debug session terminating.
        const anotherSession: DebugSession = {
            name: '',
            type: '',
            id: '1234'
        } as any;
        await handler.handleTerminateEvent(anotherSession);

        verify(procTerminationService.terminateOrphanedProcesses()).once();
        verify(procTerminationService.terminateProcess(processId)).never();
    });
});
