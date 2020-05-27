// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length

import { expect } from 'chai';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { Uri, WorkspaceFolder } from 'vscode';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { DebugService } from '../../../../client/common/application/debugService';
import { IApplicationShell, IDebugService, IWorkspaceService } from '../../../../client/common/application/types';
import { WorkspaceService } from '../../../../client/common/application/workspace';
import { ChildProcessAttachService } from '../../../../client/debugger/extension/hooks/childProcessAttachService';
import { AttachRequestArguments, LaunchRequestArguments } from '../../../../client/debugger/types';

suite('Debug - Attach to Child Process', () => {
    let shell: IApplicationShell;
    let debugService: IDebugService;
    let workspaceService: IWorkspaceService;
    let attachService: ChildProcessAttachService;

    setup(() => {
        shell = mock(ApplicationShell);
        debugService = mock(DebugService);
        workspaceService = mock(WorkspaceService);
        attachService = new ChildProcessAttachService(
            instance(shell),
            instance(debugService),
            instance(workspaceService)
        );
    });

    test('Message is not displayed if debugger is launched', async () => {
        const data: AttachRequestArguments = {
            name: 'Attach',
            type: 'python',
            request: 'attach',
            port: 1234,
            subProcessId: 2
        };
        const session: any = {};
        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(debugService.startDebugging(anything(), anything(), anything())).thenResolve(true as any);
        when(shell.showErrorMessage(anything())).thenResolve();

        await attachService.attach(data, session);

        verify(workspaceService.hasWorkspaceFolders).once();
        verify(debugService.startDebugging(anything(), anything(), anything())).once();
        verify(shell.showErrorMessage(anything())).never();
    });
    test('Message is displayed if debugger is not launched', async () => {
        const data: AttachRequestArguments = {
            name: 'Attach',
            type: 'python',
            request: 'attach',
            port: 1234,
            subProcessId: 2
        };

        const session: any = {};
        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(debugService.startDebugging(anything(), anything(), anything())).thenResolve(false as any);
        when(shell.showErrorMessage(anything())).thenResolve();

        await attachService.attach(data, session);

        verify(workspaceService.hasWorkspaceFolders).once();
        verify(debugService.startDebugging(anything(), anything(), anything())).once();
        verify(shell.showErrorMessage(anything())).once();
    });
    test('Use correct workspace folder', async () => {
        const rightWorkspaceFolder: WorkspaceFolder = { name: '1', index: 1, uri: Uri.file('a') };
        const wkspace1: WorkspaceFolder = { name: '0', index: 0, uri: Uri.file('0') };
        const wkspace2: WorkspaceFolder = { name: '2', index: 2, uri: Uri.file('2') };

        const data: AttachRequestArguments = {
            name: 'Attach',
            type: 'python',
            request: 'attach',
            port: 1234,
            subProcessId: 2,
            workspaceFolder: rightWorkspaceFolder.uri.fsPath
        };

        const session: any = {};
        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        when(workspaceService.workspaceFolders).thenReturn([wkspace1, rightWorkspaceFolder, wkspace2]);
        when(debugService.startDebugging(rightWorkspaceFolder, anything(), anything())).thenResolve(true as any);

        await attachService.attach(data, session);

        verify(workspaceService.hasWorkspaceFolders).once();
        verify(debugService.startDebugging(rightWorkspaceFolder, anything(), anything())).once();
        verify(shell.showErrorMessage(anything())).never();
    });
    test('Use empty workspace folder if right one is not found', async () => {
        const rightWorkspaceFolder: WorkspaceFolder = { name: '1', index: 1, uri: Uri.file('a') };
        const wkspace1: WorkspaceFolder = { name: '0', index: 0, uri: Uri.file('0') };
        const wkspace2: WorkspaceFolder = { name: '2', index: 2, uri: Uri.file('2') };

        const data: AttachRequestArguments = {
            name: 'Attach',
            type: 'python',
            request: 'attach',
            port: 1234,
            subProcessId: 2,
            workspaceFolder: rightWorkspaceFolder.uri.fsPath
        };

        const session: any = {};
        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        when(workspaceService.workspaceFolders).thenReturn([wkspace1, wkspace2]);
        when(debugService.startDebugging(undefined, anything(), anything())).thenResolve(true as any);

        await attachService.attach(data, session);

        verify(workspaceService.hasWorkspaceFolders).once();
        verify(debugService.startDebugging(undefined, anything(), anything())).once();
        verify(shell.showErrorMessage(anything())).never();
    });
    test('Validate debug config is passed as is', async () => {
        const data: LaunchRequestArguments | AttachRequestArguments = {
            request: 'attach',
            type: 'python',
            name: 'Attach',
            port: 1234,
            subProcessId: 2,
            host: 'localhost'
        };

        const debugConfig = JSON.parse(JSON.stringify(data));
        debugConfig.host = 'localhost';
        const session: any = {};

        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(debugService.startDebugging(undefined, anything(), anything())).thenResolve(true as any);

        await attachService.attach(data, session);

        verify(workspaceService.hasWorkspaceFolders).once();
        verify(debugService.startDebugging(undefined, anything(), anything())).once();
        const [, secondArg, thirdArg] = capture(debugService.startDebugging).last();
        expect(secondArg).to.deep.equal(debugConfig);
        expect(thirdArg).to.deep.equal(session);
        verify(shell.showErrorMessage(anything())).never();
    });
    test('Pass data as is if data is attach debug configuration', async () => {
        const data: AttachRequestArguments = {
            type: 'python',
            request: 'attach',
            name: ''
        };
        const session: any = {};
        const debugConfig = JSON.parse(JSON.stringify(data));

        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(debugService.startDebugging(undefined, anything(), anything())).thenResolve(true as any);

        await attachService.attach(data, session);

        verify(workspaceService.hasWorkspaceFolders).once();
        verify(debugService.startDebugging(undefined, anything(), anything())).once();
        const [, secondArg, thirdArg] = capture(debugService.startDebugging).last();
        expect(secondArg).to.deep.equal(debugConfig);
        expect(thirdArg).to.deep.equal(session);
        verify(shell.showErrorMessage(anything())).never();
    });
    test('Validate debug config when parent/root parent was attached', async () => {
        const data: AttachRequestArguments = {
            request: 'attach',
            type: 'python',
            name: 'Attach',
            host: '123.123.123.123',
            port: 1234,
            subProcessId: 2
        };

        const debugConfig = JSON.parse(JSON.stringify(data));
        debugConfig.host = data.host;
        debugConfig.port = data.port;
        debugConfig.request = 'attach';
        const session: any = {};

        when(workspaceService.hasWorkspaceFolders).thenReturn(false);
        when(debugService.startDebugging(undefined, anything(), anything())).thenResolve(true as any);

        await attachService.attach(data, session);

        verify(workspaceService.hasWorkspaceFolders).once();
        verify(debugService.startDebugging(undefined, anything(), anything())).once();
        const [, secondArg, thirdArg] = capture(debugService.startDebugging).last();
        expect(secondArg).to.deep.equal(debugConfig);
        expect(thirdArg).to.deep.equal(session);
        verify(shell.showErrorMessage(anything())).never();
    });
});
