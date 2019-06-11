// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { CommandManager } from '../../../client/common/application/commandManager';
import { ICommandManager } from '../../../client/common/application/types';
import { Commands } from '../../../client/common/constants';
import { IDisposableRegistry } from '../../../client/common/types';
import { getNamesAndValues } from '../../../client/common/utils/enum';
import { CommandSource } from '../../../client/testing/common/constants';
import { Tests } from '../../../client/testing/common/types';
import { AutoDisplayTestExplorer } from '../../../client/testing/explorer/autoDisplayTestExplorer';
import { UnitTestManagementService } from '../../../client/testing/main';
import { ITestManagementService } from '../../../client/testing/types';

// tslint:disable:no-any

suite('Unit Tests Test Explorer - Automatically Display', () => {
    let commandManager: ICommandManager;
    let testManagementService: ITestManagementService;
    let disposableRegistry: IDisposableRegistry;
    let autoDisplayTestExplorer: AutoDisplayTestExplorer;
    setup(() => {
        commandManager = mock(CommandManager);
        testManagementService = mock(UnitTestManagementService);
        disposableRegistry = [];
        autoDisplayTestExplorer = new AutoDisplayTestExplorer(instance(commandManager), disposableRegistry, instance(testManagementService));
    });

    test('Class is registered as a disposable item', async () => {
        expect(disposableRegistry).to.contain(autoDisplayTestExplorer);
    });
    test('Activation will register event handler once (with and without resource)', async () => {
        const onTestsDiscoveredStub = sinon.stub();
        when(testManagementService.onTestsDiscovered).thenReturn(onTestsDiscoveredStub);

        await autoDisplayTestExplorer.activate(Uri.file(__filename));
        await autoDisplayTestExplorer.activate(undefined);
        await autoDisplayTestExplorer.activate(Uri.file(__filename));
        await autoDisplayTestExplorer.activate(undefined);

        assert.ok(onTestsDiscoveredStub.calledOnceWith(autoDisplayTestExplorer.onTestsDiscovered, autoDisplayTestExplorer, []));
    });
    test('Dispose event handler', async () => {
        const onTestsDiscoveredStub = sinon.stub();
        when(testManagementService.onTestsDiscovered).thenReturn(onTestsDiscoveredStub);
        const disposable = {
            dispose: sinon.stub()
        };
        onTestsDiscoveredStub.callsFake((_: any, __: any, disposables: any[]) => {
            disposables.push(disposable);
        });

        await autoDisplayTestExplorer.activate(undefined);
        autoDisplayTestExplorer.dispose();

        assert.ok(disposable.dispose.calledOnce);
    });
    getNamesAndValues<CommandSource>(CommandSource).forEach(cmdSource => {
        test(`Display test explorer only if command source is 'auto' (without tests and ${cmdSource.name})`, async () => {
            when(commandManager.executeCommand(anything())).thenResolve();

            await autoDisplayTestExplorer.onTestsDiscovered({ triggerSource: cmdSource.value });

            verify(commandManager.executeCommand(Commands.Test_Display_Test_Explorer)).times(cmdSource.value === CommandSource.auto ? 1 : 0)
        });
        test(`Display test explorer only if command source is 'auto' (tests and ${cmdSource.name})`, async () => {
            when(commandManager.executeCommand(anything())).thenResolve();

            const tests: Tests = {
                rootTestFolders: [],
                summary: { errors: 0, failures: 0, passed: 0, skipped: 0 },
                testFiles: [], testFolders: [], testFunctions: [], testSuites: []
            };
            await autoDisplayTestExplorer.onTestsDiscovered({ triggerSource: cmdSource.value, tests });

            verify(commandManager.executeCommand(Commands.Test_Display_Test_Explorer)).times(cmdSource.value === CommandSource.auto ? 1 : 0)
        });
    });
});
