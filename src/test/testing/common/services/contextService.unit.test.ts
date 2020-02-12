// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { CommandManager } from '../../../../client/common/application/commandManager';
import { ICommandManager } from '../../../../client/common/application/types';
import { TestContextService } from '../../../../client/testing/common/services/contextService';
import { TestCollectionStorageService } from '../../../../client/testing/common/services/storageService';
import {
    ITestCollectionStorageService,
    ITestContextService,
    TestStatus
} from '../../../../client/testing/common/types';
import { UnitTestManagementService } from '../../../../client/testing/main';
import { ITestManagementService, WorkspaceTestStatus } from '../../../../client/testing/types';

// tslint:disable:no-any max-func-body-length
suite('Unit Tests - Context Service', () => {
    let cmdManager: ICommandManager;
    let contextService: ITestContextService;
    let storage: ITestCollectionStorageService;
    let mgr: ITestManagementService;
    const workspaceUri = Uri.file(__filename);
    type StatusChangeHandler = (status: WorkspaceTestStatus) => Promise<void>;
    setup(() => {
        cmdManager = mock(CommandManager);
        storage = mock(TestCollectionStorageService);
        mgr = mock(UnitTestManagementService);
        contextService = new TestContextService(instance(storage), instance(mgr), instance(cmdManager));
    });

    test('register will add event handler', () => {
        let invoked = false;
        const fn = () => (invoked = true);
        when(mgr.onDidStatusChange).thenReturn(fn as any);

        contextService.register();

        assert.equal(invoked, true);
    });
    test('Status change without tests does not update hasFailedTests', async () => {
        let handler!: StatusChangeHandler;
        const fn = (cb: StatusChangeHandler) => (handler = cb);
        when(mgr.onDidStatusChange).thenReturn(fn as any);
        when(storage.getTests(workspaceUri)).thenReturn();
        contextService.register();

        await handler.bind(contextService)({ status: TestStatus.Discovering, workspace: workspaceUri });

        verify(cmdManager.executeCommand('setContext', 'hasFailedTests', anything())).never();
    });
    test('Status change without a summary does not update hasFailedTests', async () => {
        let handler!: StatusChangeHandler;
        const fn = (cb: StatusChangeHandler) => (handler = cb);
        when(mgr.onDidStatusChange).thenReturn(fn as any);
        when(storage.getTests(workspaceUri)).thenReturn({} as any);
        contextService.register();

        await handler.bind(contextService)({ status: TestStatus.Discovering, workspace: workspaceUri });

        verify(cmdManager.executeCommand('setContext', 'hasFailedTests', anything())).never();
    });
    test('Status change with a summary updates hasFailedTests to false ', async () => {
        let handler!: StatusChangeHandler;
        const fn = (cb: StatusChangeHandler) => (handler = cb);
        when(mgr.onDidStatusChange).thenReturn(fn as any);
        when(storage.getTests(anything())).thenReturn({ summary: { failures: 0 } } as any);
        contextService.register();

        await handler.bind(contextService)({ status: TestStatus.Discovering, workspace: workspaceUri });

        verify(cmdManager.executeCommand('setContext', 'hasFailedTests', false)).once();
    });
    test('Status change with a summary and failures updates hasFailedTests to false', async () => {
        let handler!: StatusChangeHandler;
        const fn = (cb: StatusChangeHandler) => (handler = cb);
        when(mgr.onDidStatusChange).thenReturn(fn as any);
        when(storage.getTests(anything())).thenReturn({ summary: { failures: 1 } } as any);
        contextService.register();

        await handler.bind(contextService)({ status: TestStatus.Discovering, workspace: workspaceUri });

        verify(cmdManager.executeCommand('setContext', 'hasFailedTests', true)).once();
    });
    test('Status change with status of running', async () => {
        let handler!: StatusChangeHandler;
        const fn = (cb: StatusChangeHandler) => (handler = cb);
        when(mgr.onDidStatusChange).thenReturn(fn as any);
        when(storage.getTests(anything())).thenReturn({} as any);
        contextService.register();

        await handler.bind(contextService)({ status: TestStatus.Running, workspace: workspaceUri });

        verify(cmdManager.executeCommand('setContext', 'runningTests', true)).once();
        verify(cmdManager.executeCommand('setContext', 'discoveringTests', false)).once();
        verify(cmdManager.executeCommand('setContext', 'busyTests', true)).once();
    });
    test('Status change with status of discovering', async () => {
        let handler!: StatusChangeHandler;
        const fn = (cb: StatusChangeHandler) => (handler = cb);
        when(mgr.onDidStatusChange).thenReturn(fn as any);
        when(storage.getTests(anything())).thenReturn({} as any);
        contextService.register();

        await handler.bind(contextService)({ status: TestStatus.Discovering, workspace: workspaceUri });

        verify(cmdManager.executeCommand('setContext', 'runningTests', false)).once();
        verify(cmdManager.executeCommand('setContext', 'discoveringTests', true)).once();
        verify(cmdManager.executeCommand('setContext', 'busyTests', true)).once();
    });
    test('Status change with status of others', async () => {
        let handler!: StatusChangeHandler;
        const fn = (cb: StatusChangeHandler) => (handler = cb);
        when(mgr.onDidStatusChange).thenReturn(fn as any);
        when(storage.getTests(anything())).thenReturn({} as any);
        contextService.register();

        await handler.bind(contextService)({ status: TestStatus.Error, workspace: workspaceUri });
        await handler.bind(contextService)({ status: TestStatus.Fail, workspace: workspaceUri });
        await handler.bind(contextService)({ status: TestStatus.Idle, workspace: workspaceUri });
        await handler.bind(contextService)({ status: TestStatus.Pass, workspace: workspaceUri });
        await handler.bind(contextService)({ status: TestStatus.Skipped, workspace: workspaceUri });
        await handler.bind(contextService)({ status: TestStatus.Unknown, workspace: workspaceUri });

        verify(cmdManager.executeCommand('setContext', 'runningTests', false)).once();
        verify(cmdManager.executeCommand('setContext', 'discoveringTests', false)).once();
        verify(cmdManager.executeCommand('setContext', 'busyTests', false)).once();

        verify(cmdManager.executeCommand('setContext', 'runningTests', true)).never();
        verify(cmdManager.executeCommand('setContext', 'discoveringTests', true)).never();
        verify(cmdManager.executeCommand('setContext', 'busyTests', true)).never();
    });
});
