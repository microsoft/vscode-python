// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IDisposable } from '@phosphor/disposable';
import { anything, capture, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { CommandManager } from '../../../client/common/application/commandManager';
import { ICommandManager } from '../../../client/common/application/types';
import { Commands } from '../../../client/common/constants';
import { CommandSource } from '../../../client/testing/common/constants';
import { TestFile, TestFunction, TestsToRun, TestSuite } from '../../../client/testing/common/types';
import { TestExplorerCommandHandler } from '../../../client/testing/explorer/commandHandlers';
import { TestTreeViewProvider } from '../../../client/testing/explorer/testTreeViewProvider';
import { ITestExplorerCommandHandler } from '../../../client/testing/navigation/types';
import { ITestDataItemResource } from '../../../client/testing/types';

// tslint:disable:no-any max-func-body-length
suite('Unit Tests - Test Explorer Command Handler', () => {
    let commandHandler: ITestExplorerCommandHandler;
    let cmdManager: ICommandManager;
    let testResourceMapper: ITestDataItemResource;

    setup(() => {
        cmdManager = mock(CommandManager);
        testResourceMapper = mock(TestTreeViewProvider);
        commandHandler = new TestExplorerCommandHandler(instance(cmdManager), instance(testResourceMapper));
    });
    test('Commands are registered', () => {
        commandHandler.register();

        verify(cmdManager.registerCommand(Commands.runTestNode, anything(), commandHandler)).once();
        verify(cmdManager.registerCommand(Commands.debugTestNode, anything(), commandHandler)).once();
        verify(cmdManager.registerCommand(Commands.openTestNodeInEditor, anything(), commandHandler)).once();
    });
    test('Handlers are disposed', () => {
        const disposable1 = typemoq.Mock.ofType<IDisposable>();
        const disposable2 = typemoq.Mock.ofType<IDisposable>();
        const disposable3 = typemoq.Mock.ofType<IDisposable>();

        when(cmdManager.registerCommand(Commands.runTestNode, anything(), commandHandler)).thenReturn(disposable1.object);
        when(cmdManager.registerCommand(Commands.debugTestNode, anything(), commandHandler)).thenReturn(disposable2.object);
        when(cmdManager.registerCommand(Commands.openTestNodeInEditor, anything(), commandHandler)).thenReturn(disposable3.object);

        commandHandler.register();
        commandHandler.dispose();

        disposable1.verify(d => d.dispose(), typemoq.Times.once());
        disposable2.verify(d => d.dispose(), typemoq.Times.once());
        disposable3.verify(d => d.dispose(), typemoq.Times.once());
    });
    async function testOpeningTestNode(data: TestFile | TestSuite | TestFunction, expectedCommand: 'navigateToTestFunction' | 'navigateToTestSuite' | 'navigateToTestFile') {
        const resource = Uri.file(__filename);
        when(testResourceMapper.getResource(data)).thenReturn(resource);

        commandHandler.register();

        const handler = (capture(cmdManager.registerCommand as any).last()[1] as any) as Function;
        await handler.bind(commandHandler)(data);

        verify(cmdManager.executeCommand(expectedCommand, resource, data, true)).once();
    }
    test('Opening a file will invoke correct command', async () => {
        const testFilePath = 'some file path';
        const data: TestFile = { fullPath: testFilePath } as any;
        await testOpeningTestNode(data, Commands.navigateToTestFile);
    });
    test('Opening a test suite will invoke correct command', async () => {
        const data: TestSuite = { suites: [] } as any;
        await testOpeningTestNode(data, Commands.navigateToTestSuite);
    });
    test('Opening a test function will invoke correct command', async () => {
        const data: TestFunction = { name: 'hello' } as any;
        await testOpeningTestNode(data, Commands.navigateToTestFunction);
    });
    async function testRunOrDebugTestNode(data: TestFile | TestSuite | TestFunction, expectedTestRun: TestsToRun, runType: 'run' | 'debug') {
        const resource = Uri.file(__filename);
        when(testResourceMapper.getResource(data)).thenReturn(resource);

        commandHandler.register();

        const capturedCommand = capture(cmdManager.registerCommand as any);
        const handler = ((runType === 'run' ? capturedCommand.first()[1] : capturedCommand.second()[1]) as any) as Function;
        await handler.bind(commandHandler)(data);

        const cmd = runType === 'run' ? Commands.Tests_Run : Commands.Tests_Debug;
        verify(cmdManager.executeCommand(cmd, undefined, CommandSource.testExplorer, resource, deepEqual(expectedTestRun))).once();
    }
    test('Running a file will invoke correct command', async () => {
        const testFilePath = 'some file path';
        const data: TestFile = { fullPath: testFilePath } as any;
        await testRunOrDebugTestNode(data, { testFile: [data] }, 'run');
    });
    test('Running a suite will invoke correct command', async () => {
        const data: TestSuite = { suites: [] } as any;
        await testRunOrDebugTestNode(data, { testSuite: [data] }, 'run');
    });
    test('Running a function will invoke correct command', async () => {
        const data: TestSuite = { suites: [] } as any;
        await testRunOrDebugTestNode(data, { testSuite: [data] }, 'run');
    });
    test('Debugging a file will invoke correct command', async () => {
        const testFilePath = 'some file path';
        const data: TestFile = { fullPath: testFilePath } as any;
        await testRunOrDebugTestNode(data, { testFile: [data] }, 'debug');
    });
    test('Debugging a suite will invoke correct command', async () => {
        const data: TestSuite = { suites: [] } as any;
        await testRunOrDebugTestNode(data, { testSuite: [data] }, 'debug');
    });
    test('Debugging a function will invoke correct command', async () => {
        const data: TestSuite = { suites: [] } as any;
        await testRunOrDebugTestNode(data, { testSuite: [data] }, 'debug');
    });
});
