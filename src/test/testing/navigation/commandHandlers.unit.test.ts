// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { CommandManager } from '../../../client/common/application/commandManager';
import { ICommandManager } from '../../../client/common/application/types';
import { AsyncDisposableRegistry } from '../../../client/common/asyncDisposableRegistry';
import { Commands } from '../../../client/common/constants';
import { IDisposable, IDisposableRegistry } from '../../../client/common/types';
import { TestCodeNavigatorCommandHandler } from '../../../client/testing/navigation/commandHandler';
import { TestFileCodeNavigator } from '../../../client/testing/navigation/fileNavigator';
import { TestFunctionCodeNavigator } from '../../../client/testing/navigation/functionNavigator';
import { TestSuiteCodeNavigator } from '../../../client/testing/navigation/suiteNavigator';
import { ITestCodeNavigator, ITestCodeNavigatorCommandHandler } from '../../../client/testing/navigation/types';

// tslint:disable:max-func-body-length
suite('Unit Tests - Navigation Command Handler', () => {
    let commandHandler: ITestCodeNavigatorCommandHandler;
    let cmdManager: ICommandManager;
    let fileHandler: ITestCodeNavigator;
    let functionHandler: ITestCodeNavigator;
    let suiteHandler: ITestCodeNavigator;
    let disposableRegistry: IDisposableRegistry;
    setup(() => {
        cmdManager = mock(CommandManager);
        fileHandler = mock(TestFileCodeNavigator);
        functionHandler = mock(TestFunctionCodeNavigator);
        suiteHandler = mock(TestSuiteCodeNavigator);
        disposableRegistry = mock(AsyncDisposableRegistry);
        commandHandler = new TestCodeNavigatorCommandHandler(
            instance(cmdManager),
            instance(fileHandler),
            instance(functionHandler),
            instance(suiteHandler),
            instance(disposableRegistry)
        );
    });
    test('Ensure Navigation handlers are registered', async () => {
        commandHandler.register();
        verify(
            cmdManager.registerCommand(
                Commands.navigateToTestFile,
                instance(fileHandler).navigateTo,
                instance(fileHandler)
            )
        ).once();
        verify(
            cmdManager.registerCommand(
                Commands.navigateToTestFunction,
                instance(functionHandler).navigateTo,
                instance(functionHandler)
            )
        ).once();
        verify(
            cmdManager.registerCommand(
                Commands.navigateToTestSuite,
                instance(suiteHandler).navigateTo,
                instance(suiteHandler)
            )
        ).once();
    });
    test('Ensure handlers are disposed', async () => {
        const disposable1 = typemoq.Mock.ofType<IDisposable>();
        const disposable2 = typemoq.Mock.ofType<IDisposable>();
        const disposable3 = typemoq.Mock.ofType<IDisposable>();
        when(
            cmdManager.registerCommand(
                Commands.navigateToTestFile,
                instance(fileHandler).navigateTo,
                instance(fileHandler)
            )
        ).thenReturn(disposable1.object);
        when(
            cmdManager.registerCommand(
                Commands.navigateToTestFunction,
                instance(functionHandler).navigateTo,
                instance(functionHandler)
            )
        ).thenReturn(disposable2.object);
        when(
            cmdManager.registerCommand(
                Commands.navigateToTestSuite,
                instance(suiteHandler).navigateTo,
                instance(suiteHandler)
            )
        ).thenReturn(disposable3.object);

        commandHandler.register();
        commandHandler.dispose();

        disposable1.verify(d => d.dispose(), typemoq.Times.once());
        disposable2.verify(d => d.dispose(), typemoq.Times.once());
        disposable3.verify(d => d.dispose(), typemoq.Times.once());
    });
    test('Ensure command handler is reigstered to be disposed', async () => {
        commandHandler.register();
        verify(disposableRegistry.push(commandHandler)).once();
    });
});
