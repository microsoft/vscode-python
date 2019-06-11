// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { TreeView, Uri } from 'vscode';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { CommandManager } from '../../../client/common/application/commandManager';
import { IApplicationShell, ICommandManager } from '../../../client/common/application/types';
import { Commands } from '../../../client/common/constants';
import { TestTreeViewProvider } from '../../../client/testing/explorer/testTreeViewProvider';
import { TreeViewService } from '../../../client/testing/explorer/treeView';
import { ITestTreeViewProvider, TestDataItem } from '../../../client/testing/types';

// tslint:disable:no-any

suite('Unit Tests Test Explorer Tree View', () => {
    let treeViewService: TreeViewService;
    let treeView: typemoq.IMock<TreeView<TestDataItem>>;
    let commandManager: ICommandManager;
    let appShell: IApplicationShell;
    let treeViewProvider: ITestTreeViewProvider;
    setup(() => {
        commandManager = mock(CommandManager);
        treeViewProvider = mock(TestTreeViewProvider);
        appShell = mock(ApplicationShell);
        treeView = typemoq.Mock.ofType<TreeView<TestDataItem>>();
        treeViewService = new TreeViewService(instance(treeViewProvider), [],
            instance(appShell), instance(commandManager));
    });

    test('Activation will create the treeview (without a resource)', async () => {
        await treeViewService.activate(undefined);
        verify(appShell.createTreeView('python_tests', deepEqual({ showCollapseAll: true, treeDataProvider: instance(treeViewProvider) }))).once();
    });
    test('Activation will create the treeview (with a resource)', async () => {
        await treeViewService.activate(Uri.file(__filename));
        verify(appShell.createTreeView('python_tests', deepEqual({ showCollapseAll: true, treeDataProvider: instance(treeViewProvider) }))).once();
    });
    test('Activation will add command handlers once (with & without a resource)', async () => {
        await treeViewService.activate(undefined);
        await treeViewService.activate(undefined);
        await treeViewService.activate(Uri.file(__filename));
        await treeViewService.activate(Uri.file(__filename));

        verify(commandManager.registerCommand(Commands.Test_Reveal_Test_Item, treeViewService.onRevealTestItem, treeViewService)).once();
        verify(commandManager.registerCommand(Commands.Test_Display_Test_Explorer, treeViewService.show, treeViewService)).once();
    });
    test('Invoking the command handler will reveal the node in the tree', async () => {
        const data = {} as any;
        treeView
            .setup(t => t.reveal(typemoq.It.isAny()))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());
        when(appShell.createTreeView('python_tests', anything())).thenReturn(treeView.object);

        await treeViewService.activate(undefined);
        await treeViewService.onRevealTestItem(data);

        treeView.verifyAll();
    });
    test('Command used to display test explorer is not invoked if test explorer is not already visible', async () => {
        (treeViewService as any)._treeView = { visible: true };

        await treeViewService.show();

        verify(commandManager.executeCommand('workbench.view.extension.test')).never();
    });
    test('Command used to display test explorer is invoked if test explorer is not visible', async () => {
        (treeViewService as any)._treeView = { visible: false };

        await treeViewService.show();

        verify(commandManager.executeCommand('workbench.view.extension.test')).once();
    });
});
