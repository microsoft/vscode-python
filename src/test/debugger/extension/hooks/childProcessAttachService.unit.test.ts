// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length

import { expect } from 'chai';
import * as path from 'path';
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
        const session: any = {};
        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(debugService.startDebugging(anything(), anything(), anything())).thenResolve(true as any);
        await service.attach(data, session);
        verify(workspaceService.hasWorkspaceFolders).once();
        verify(debugService.startDebugging(anything(), anything(), anything())).once();
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

        const session: any = {};
        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(debugService.startDebugging(anything(), anything(), anything())).thenResolve(false as any);
        when(shell.showErrorMessage(anything())).thenResolve();

        await service.attach(data, session);

        verify(workspaceService.hasWorkspaceFolders).once();
        verify(debugService.startDebugging(anything(), anything(), anything())).once();
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

        const session: any = {};
        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        when(workspaceService.workspaceFolders).thenReturn([wkspace1, rightWorkspaceFolder, wkspace2]);
        when(debugService.startDebugging(rightWorkspaceFolder, anything(), anything())).thenResolve(true as any);

        await service.attach(data, session);

        verify(workspaceService.hasWorkspaceFolders).once();
        verify(debugService.startDebugging(rightWorkspaceFolder, anything(), anything())).once();
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

        const session: any = {};
        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        when(workspaceService.workspaceFolders).thenReturn([wkspace1, wkspace2]);
        when(debugService.startDebugging(undefined, anything(), anything())).thenResolve(true as any);

        await service.attach(data, session);

        verify(workspaceService.hasWorkspaceFolders).once();
        verify(debugService.startDebugging(undefined, anything(), anything())).once();
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
        const session: any = {};

        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(debugService.startDebugging(undefined, anything(), anything())).thenResolve(true as any);

        await service.attach(data, session);

        verify(workspaceService.hasWorkspaceFolders).once();
        verify(debugService.startDebugging(undefined, anything(), anything())).once();
        const [, secondArg, thirdArg] = capture(debugService.startDebugging).last();
        expect(secondArg).to.deep.equal(debugConfig);
        expect(thirdArg).to.deep.equal(session);
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
        const session: any = {};

        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(debugService.startDebugging(undefined, anything(), anything())).thenResolve(true as any);

        await service.attach(data, session);

        verify(workspaceService.hasWorkspaceFolders).once();
        verify(debugService.startDebugging(undefined, anything(), anything())).once();
        const [, secondArg, thirdArg] = capture(debugService.startDebugging).last();
        expect(secondArg).to.deep.equal(debugConfig);
        expect(thirdArg).to.deep.equal(session);
        verify(shell.showErrorMessage(anything())).never();
    });
    test('Path mappings are not set when there is no workspace folder', async () => {
        const shell = mock(ApplicationShell);
        const debugService = mock(DebugService);
        const workspaceService = mock(WorkspaceService);
        const service = new ChildProcessAttachService(instance(shell), instance(debugService), instance(workspaceService));

        const args: LaunchRequestArguments & AttachRequestArguments = {
            request: 'launch',
            type: 'python',
            name: '',
            pythonPath: '', args: [], envFile: ''
        };

        service.fixPathMappings(args);

        expect(args.pathMappings).to.equal(undefined, 'Not undefined');
    });
    test('Path mappings are left untouched when they are provided', async () => {
        const shell = mock(ApplicationShell);
        const debugService = mock(DebugService);
        const workspaceService = mock(WorkspaceService);
        const service = new ChildProcessAttachService(instance(shell), instance(debugService), instance(workspaceService));

        const pathMappings = [{ localRoot: '1', remoteRoot: '2' }];
        const args: LaunchRequestArguments & AttachRequestArguments = {
            request: 'launch',
            type: 'python',
            name: '',
            workspaceFolder: __dirname,
            pythonPath: '', args: [], envFile: '',
            pathMappings: pathMappings
        };

        service.fixPathMappings(args);

        expect(args.pathMappings).to.deep.equal(pathMappings);
    });
    test('Path mappings default to workspace folder', async () => {
        const shell = mock(ApplicationShell);
        const debugService = mock(DebugService);
        const workspaceService = mock(WorkspaceService);
        const service = new ChildProcessAttachService(instance(shell), instance(debugService), instance(workspaceService));

        const expectedPathMappings = [{ localRoot: __dirname, remoteRoot: '.' }];
        const args: LaunchRequestArguments & AttachRequestArguments = {
            request: 'launch',
            type: 'python',
            name: '',
            workspaceFolder: __dirname,
            pythonPath: '', args: [], envFile: ''
        };

        service.fixPathMappings(args);

        expect(args.pathMappings).to.deep.equal(expectedPathMappings);
    });
    test('Path mappings default to cwd folder', async () => {
        const shell = mock(ApplicationShell);
        const debugService = mock(DebugService);
        const workspaceService = mock(WorkspaceService);
        const service = new ChildProcessAttachService(instance(shell), instance(debugService), instance(workspaceService));

        const expectedPathMappings = [{ localRoot: path.join('hello', 'world'), remoteRoot: '.' }];
        const args: LaunchRequestArguments & AttachRequestArguments = {
            request: 'launch',
            type: 'python',
            name: '',
            cwd: path.join('hello', 'world'),
            workspaceFolder: __dirname,
            pythonPath: '', args: [], envFile: ''
        };

        service.fixPathMappings(args);

        expect(args.pathMappings).to.deep.equal(expectedPathMappings);
    });
    test('Path mappings default to cwd folder relative to workspace folder', async () => {
        const shell = mock(ApplicationShell);
        const debugService = mock(DebugService);
        const workspaceService = mock(WorkspaceService);
        const service = new ChildProcessAttachService(instance(shell), instance(debugService), instance(workspaceService));

        const expectedPathMappings = [{ localRoot: path.join(__dirname, 'hello', 'world'), remoteRoot: '.' }];
        const args: LaunchRequestArguments & AttachRequestArguments = {
            request: 'launch',
            type: 'python',
            name: '',
            // tslint:disable-next-line: no-invalid-template-strings
            cwd: path.join('${workspaceFolder}', 'hello', 'world'),
            workspaceFolder: __dirname,
            pythonPath: '', args: [], envFile: ''
        };

        service.fixPathMappings(args);

        expect(args.pathMappings).to.deep.equal(expectedPathMappings);
    });
});
