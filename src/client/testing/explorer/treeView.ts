// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { TreeView } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IApplicationShell, ICommandManager } from '../../common/application/types';
import { Commands } from '../../common/constants';
import { IDisposable, IDisposableRegistry } from '../../common/types';
import { ITestTreeViewProvider, TestDataItem } from '../types';

@injectable()
export class TreeViewService implements IExtensionSingleActivationService, IDisposable {
    private _treeView!: TreeView<TestDataItem>;
    private readonly disposables: IDisposable[] = [];
    public get treeView(): TreeView<TestDataItem> {
        return this._treeView;
    }
    constructor(
        @inject(ITestTreeViewProvider) private readonly treeViewProvider: ITestTreeViewProvider,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(ICommandManager) private readonly commandManager: ICommandManager
    ) {
        disposableRegistry.push(this);
    }
    public dispose() {
        this.disposables.forEach((d) => d.dispose());
    }
    public async activate(): Promise<void> {
        this._treeView = this.appShell.createTreeView('python_tests', {
            showCollapseAll: true,
            treeDataProvider: this.treeViewProvider,
        });
        this.disposables.push(this._treeView);
        this.disposables.push(
            this.commandManager.registerCommand(Commands.Test_Reveal_Test_Item, this.onRevealTestItem, this)
        );
    }
    public async onRevealTestItem(testItem: TestDataItem): Promise<void> {
        await this.treeView.reveal(testItem);
    }
}
