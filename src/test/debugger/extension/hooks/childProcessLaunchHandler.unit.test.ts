// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { DebugService } from '../../../../client/common/application/debugService';
import { WorkspaceService } from '../../../../client/common/application/workspace';
import { ChildProcessLaunchEventHandler } from '../../../../client/debugger/extension/hooks/childProcessLaunchHandler';

suite('Debug - Debug Child Process', () => {
    const twoWorkspaces = [{ uri: Uri.file(''), name: '', index: 0 }, { uri: Uri.file(''), name: '', index: 0 }];
    test('Debugger is not launched when data is invalid', async () => {
        const shell = mock(ApplicationShell);
        const debugMgr = mock(DebugService);
        const workspace = mock(WorkspaceService);
        const handler = new ChildProcessLaunchEventHandler(instance(shell), instance(debugMgr), instance(workspace));
        await handler.handleEvent({ event: '', session: {} as any });
    });

    test('Debugger is not launched when data is invalid', async () => {
        const shell = mock(ApplicationShell);
        const debugMgr = mock(DebugService);
        const workspace = mock(WorkspaceService);
        when(workspace.workspaceFolders).thenReturn(twoWorkspaces);
        (when(debugMgr.startDebugging(twoWorkspaces[0], anything())) as any).thenReturn(true);
        const handler = new ChildProcessLaunchEventHandler(instance(shell), instance(debugMgr), instance(workspace));
        await handler.handleEvent({ event: '', session: {} as any });
        verify(workspace.workspaceFolders).once();
        verify(debugMgr.startDebugging).once();
    });
});
