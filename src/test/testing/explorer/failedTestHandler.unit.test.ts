// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { CommandManager } from '../../../client/common/application/commandManager';
import { ICommandManager } from '../../../client/common/application/types';
import { Commands } from '../../../client/common/constants';
import { TestCollectionStorageService } from '../../../client/testing/common/services/storageService';
import {
    ITestCollectionStorageService,
    TestFile,
    TestFolder,
    TestFunction,
    TestStatus,
    TestSuite
} from '../../../client/testing/common/types';
import { FailedTestHandler } from '../../../client/testing/explorer/failedTestHandler';
import { noop, sleep } from '../../core';

// tslint:disable:no-any

suite('Unit Tests Test Explorer View Items', () => {
    let failedTestHandler: FailedTestHandler;
    let commandManager: ICommandManager;
    let testStorageService: ITestCollectionStorageService;
    setup(() => {
        commandManager = mock(CommandManager);
        testStorageService = mock(TestCollectionStorageService);
        failedTestHandler = new FailedTestHandler([], instance(commandManager), instance(testStorageService));
    });

    test('Activation will add command handlers', async () => {
        when(testStorageService.onDidChange).thenReturn(noop as any);

        await failedTestHandler.activate();

        verify(testStorageService.onDidChange).once();
    });
    test('Change handler will invoke the command to reveal the nodes (for failed and errored items)', async () => {
        const uri = Uri.file(__filename);
        const failedFunc1: TestFunction = {
            name: 'fn1',
            time: 0,
            resource: uri,
            nameToRun: 'fn1',
            status: TestStatus.Error
        };
        const failedFunc2: TestFunction = {
            name: 'fn2',
            time: 0,
            resource: uri,
            nameToRun: 'fn2',
            status: TestStatus.Fail
        };
        when(commandManager.executeCommand(Commands.Test_Reveal_Test_Item, anything())).thenResolve();

        failedTestHandler.onDidChangeTestData({ uri, data: failedFunc1 });
        failedTestHandler.onDidChangeTestData({ uri, data: failedFunc2 });

        // wait for debouncing to take effect.
        await sleep(1);

        verify(commandManager.executeCommand(Commands.Test_Reveal_Test_Item, anything())).times(2);
        verify(commandManager.executeCommand(Commands.Test_Reveal_Test_Item, failedFunc1)).once();
        verify(commandManager.executeCommand(Commands.Test_Reveal_Test_Item, failedFunc2)).once();
    });
    test('Change handler will not invoke the command to reveal the nodes (for failed and errored suites, files & folders)', async () => {
        const uri = Uri.file(__filename);
        const failedSuite: TestSuite = {
            name: 'suite1',
            time: 0,
            resource: uri,
            nameToRun: 'suite1',
            functions: [],
            isInstance: false,
            isUnitTest: false,
            suites: [],
            xmlName: 'suite1',
            status: TestStatus.Error
        };
        const failedFile: TestFile = {
            name: 'suite1',
            time: 0,
            resource: uri,
            nameToRun: 'file',
            functions: [],
            suites: [],
            xmlName: 'file',
            status: TestStatus.Error,
            fullPath: ''
        };
        const failedFolder: TestFolder = {
            name: 'suite1',
            time: 0,
            resource: uri,
            nameToRun: 'file',
            testFiles: [],
            folders: [],
            status: TestStatus.Error
        };
        when(commandManager.executeCommand(Commands.Test_Reveal_Test_Item, anything())).thenResolve();

        failedTestHandler.onDidChangeTestData({ uri, data: failedSuite });
        failedTestHandler.onDidChangeTestData({ uri, data: failedFile });
        failedTestHandler.onDidChangeTestData({ uri, data: failedFolder });

        // wait for debouncing to take effect.
        await sleep(1);

        verify(commandManager.executeCommand(Commands.Test_Reveal_Test_Item, anything())).never();
    });
});
