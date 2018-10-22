// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { instance, mock } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { DebugSession, Uri } from 'vscode';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { DebugService } from '../../../../client/common/application/debugService';
import { IApplicationShell, IDebugService, IWorkspaceService } from '../../../../client/common/application/types';
import { WorkspaceService } from '../../../../client/common/application/workspace';
import { ChildProcessLaunchEventHandler } from '../../../../client/debugger/extension/hooks/childProcessLaunchHandler';

const ptvsdEventName = 'ptvsd_subprocess';

suite('Debugx - Debug Child Process', () => {
    const twoWorkspaces = [{ uri: Uri.file('a'), name: '', index: 0 }, { uri: Uri.file(''), name: '', index: 0 }];
    test('No errors are raised when debugger is not launched with invalid data', async () => {
        const shell = mock(ApplicationShell);
        const debugMgr = mock(DebugService);
        const workspace = mock(WorkspaceService);
        const handler = new ChildProcessLaunchEventHandler(instance(shell), instance(debugMgr), instance(workspace));
        await handler.handleEvent({ event: ptvsdEventName, session: {} as any });
    });

    test('Debugger is launched when data is valid', async () => {
        const shell = typemoq.Mock.ofType<IApplicationShell>();
        const debugMgr = typemoq.Mock.ofType<IDebugService>();
        const workspace = typemoq.Mock.ofType<IWorkspaceService>();
        workspace
            .setup(w => w.workspaceFolders)
            .returns(() => twoWorkspaces)
            .verifiable(typemoq.Times.atLeastOnce());
        workspace
            .setup(w => w.hasWorkspaceFolders)
            .returns(() => true)
            .verifiable(typemoq.Times.atLeastOnce());
        debugMgr
            .setup(d => d.startDebugging(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(typemoq.Times.once());

        const handler = new ChildProcessLaunchEventHandler(shell.object, debugMgr.object, workspace.object);
        const session: DebugSession = {} as any;
        const body = {
            rootProcessId: 1,
            initialProcessId: 1,
            rootStartRequest: {
                // tslint:disable-next-line:no-banned-terms
                arguments: {
                    workspaceFolder: 'a'
                },
                command: 'attach',
                seq: 1,
                type: 'request'
            },
            parentProcessId: 1,
            processId: 1,
            port: 1234
        };

        await handler.handleEvent({ event: ptvsdEventName, session, body });

        workspace.verifyAll();
        debugMgr.verifyAll();
    });

    test('Message is displayed if debugger is not launched', async () => {
        const shell = typemoq.Mock.ofType<IApplicationShell>();
        const debugMgr = typemoq.Mock.ofType<IDebugService>();
        const workspace = typemoq.Mock.ofType<IWorkspaceService>();
        workspace
            .setup(w => w.workspaceFolders)
            .returns(() => []);
        workspace
            .setup(w => w.hasWorkspaceFolders)
            .returns(() => false);
        debugMgr
            .setup(d => d.startDebugging(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => Promise.resolve(false))
            .verifiable(typemoq.Times.once());
        shell
            .setup(s => s.showErrorMessage(typemoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typemoq.Times.once());

        const handler = new ChildProcessLaunchEventHandler(shell.object, debugMgr.object, workspace.object);
        const session: DebugSession = {} as any;
        const body = {
            rootProcessId: 1,
            initialProcessId: 1,
            rootStartRequest: {
                // tslint:disable-next-line:no-banned-terms
                arguments: {
                    workspaceFolder: 'a'
                },
                command: 'attach',
                seq: 1,
                type: 'request'
            },
            parentProcessId: 1,
            processId: 1,
            port: 1234
        };

        await handler.handleEvent({ event: ptvsdEventName, session, body });

        debugMgr.verifyAll();
        shell.verifyAll();
    });
});
