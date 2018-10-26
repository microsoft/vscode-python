// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length

import { expect } from 'chai';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { Uri, WorkspaceFolder } from 'vscode';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { DebugService } from '../../../../client/common/application/debugService';
import { WorkspaceService } from '../../../../client/common/application/workspace';
import { ChildProcessAttachService } from '../../../../client/debugger/extension/hooks/childProcessAttachService';
import { ChildProcessLaunchData } from '../../../../client/debugger/extension/hooks/types';
import { AttachRequestArguments, LaunchRequestArguments } from '../../../../client/debugger/types';

suite('Debug - Attach to Child Process', () => {
    test('Message is not displayed if debugger is launched', async () => {
        const shell = mock(ApplicationShell);
        const debugService = mock(DebugService);
        const workspaceService = mock(WorkspaceService);
        const service = new ChildProcessAttachService(instance(shell), instance(debugService), instance(workspaceService));
        const args: LaunchRequestArguments | AttachRequestArguments = {
            request: 'launch',
            type: 'python',
            name: ''
        };
        const data: ChildProcessLaunchData = {
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

        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(debugService.startDebugging(anything(), anything())).thenResolve(true as any);
        await service.attach(data);
        verify(workspaceService.hasWorkspaceFolders).once();
        verify(debugService.startDebugging(anything(), anything())).once();
    });
    test('Message is displayed if debugger is not launched', async () => {
        const shell = mock(ApplicationShell);
        const debugService = mock(DebugService);
        const workspaceService = mock(WorkspaceService);
        const service = new ChildProcessAttachService(instance(shell), instance(debugService), instance(workspaceService));
        const args: LaunchRequestArguments | AttachRequestArguments = {
            request: 'launch',
            type: 'python',
            name: ''
        };
        const data: ChildProcessLaunchData = {
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

        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(debugService.startDebugging(anything(), anything())).thenResolve(false as any);
        when(shell.showErrorMessage(anything())).thenResolve();

        await service.attach(data);

        verify(workspaceService.hasWorkspaceFolders).once();
        verify(debugService.startDebugging(anything(), anything())).once();
        verify(shell.showErrorMessage(anything())).once();
    });
    test('Use correct workspace folder', async () => {
        const shell = mock(ApplicationShell);
        const debugService = mock(DebugService);
        const workspaceService = mock(WorkspaceService);
        const service = new ChildProcessAttachService(instance(shell), instance(debugService), instance(workspaceService));
        const rightWorkspaceFolder: WorkspaceFolder = { name: '1', index: 1, uri: Uri.file('a') };
        const wkspace1: WorkspaceFolder = { name: '0', index: 0, uri: Uri.file('0') };
        const wkspace2: WorkspaceFolder = { name: '2', index: 2, uri: Uri.file('2') };

        const args: LaunchRequestArguments | AttachRequestArguments = {
            request: 'launch',
            type: 'python',
            name: '',
            workspaceFolder: rightWorkspaceFolder.uri.fsPath
        };
        const data: ChildProcessLaunchData = {
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

        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        when(workspaceService.workspaceFolders).thenReturn([wkspace1, rightWorkspaceFolder, wkspace2]);
        when(debugService.startDebugging(rightWorkspaceFolder, anything())).thenResolve(true as any);

        await service.attach(data);

        verify(workspaceService.hasWorkspaceFolders).once();
        verify(debugService.startDebugging(rightWorkspaceFolder, anything())).once();
        verify(shell.showErrorMessage(anything())).never();
    });
    test('Use empty workspace folder if right one is not found', async () => {
        const shell = mock(ApplicationShell);
        const debugService = mock(DebugService);
        const workspaceService = mock(WorkspaceService);
        const service = new ChildProcessAttachService(instance(shell), instance(debugService), instance(workspaceService));
        const rightWorkspaceFolder: WorkspaceFolder = { name: '1', index: 1, uri: Uri.file('a') };
        const wkspace1: WorkspaceFolder = { name: '0', index: 0, uri: Uri.file('0') };
        const wkspace2: WorkspaceFolder = { name: '2', index: 2, uri: Uri.file('2') };

        const args: LaunchRequestArguments | AttachRequestArguments = {
            request: 'launch',
            type: 'python',
            name: '',
            workspaceFolder: rightWorkspaceFolder.uri.fsPath
        };
        const data: ChildProcessLaunchData = {
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

        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        when(workspaceService.workspaceFolders).thenReturn([wkspace1, wkspace2]);
        when(debugService.startDebugging(undefined, anything())).thenResolve(true as any);

        await service.attach(data);

        verify(workspaceService.hasWorkspaceFolders).once();
        verify(debugService.startDebugging(undefined, anything())).once();
        verify(shell.showErrorMessage(anything())).never();
    });
    test('Validate debug config when parent/root parent was launched', async () => {
        const shell = mock(ApplicationShell);
        const debugService = mock(DebugService);
        const workspaceService = mock(WorkspaceService);
        const service = new ChildProcessAttachService(instance(shell), instance(debugService), instance(workspaceService));

        const args: LaunchRequestArguments | AttachRequestArguments = {
            request: 'launch',
            type: 'python',
            name: ''
        };
        const data: ChildProcessLaunchData = {
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

        const debugConfig = JSON.parse(JSON.stringify(args));
        debugConfig.host = 'localhost';
        debugConfig.port = data.port;
        debugConfig.name = `Child Process ${data.processId}`;
        debugConfig.request = 'attach';

        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(debugService.startDebugging(undefined, anything())).thenResolve(true as any);
        // when(debugService.startDebugging(undefined, debugConfig)).thenResolve(true as any);

        await service.attach(data);

        verify(workspaceService.hasWorkspaceFolders).once();
        verify(debugService.startDebugging(undefined, anything())).once();
        const [, secondArg] = capture(debugService.startDebugging).last();
        expect(secondArg).to.deep.equal(debugConfig);
        verify(shell.showErrorMessage(anything())).never();
    });
    test('Validate debug config when parent/root parent was attached', async () => {
        const shell = mock(ApplicationShell);
        const debugService = mock(DebugService);
        const workspaceService = mock(WorkspaceService);
        const service = new ChildProcessAttachService(instance(shell), instance(debugService), instance(workspaceService));

        const args: AttachRequestArguments = {
            request: 'attach',
            type: 'python',
            name: '',
            host: '123.123.123.123'
        };
        const data: ChildProcessLaunchData = {
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

        const debugConfig = JSON.parse(JSON.stringify(args));
        debugConfig.host = args.host!;
        debugConfig.port = data.port;
        debugConfig.name = `Child Process ${data.processId}`;
        debugConfig.request = 'attach';

        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(debugService.startDebugging(undefined, anything())).thenResolve(true as any);
        // when(debugService.startDebugging(undefined, debugConfig)).thenResolve(true as any);

        await service.attach(data);

        verify(workspaceService.hasWorkspaceFolders).once();
        verify(debugService.startDebugging(undefined, anything())).once();
        const [, secondArg] = capture(debugService.startDebugging).last();
        expect(secondArg).to.deep.equal(debugConfig);
        verify(shell.showErrorMessage(anything())).never();
    });
});
