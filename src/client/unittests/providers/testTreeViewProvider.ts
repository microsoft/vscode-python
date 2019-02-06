// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import {
    Event, EventEmitter, ProviderResult, Uri
} from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import { traceDecorators } from '../../common/logger';
import {
    IDisposable, IDisposableRegistry, Resource
} from '../../common/types';
import { ITestTreeViewProvider } from '../../providers/types';
import {
    ITestCollectionStorageService, TestFolder, Tests, TestStatus
} from '../common/types';
import {
    TestTreeItem, TestTreeItemType
} from './testTreeViewItem';

@injectable()
export class TestTreeViewProvider implements ITestTreeViewProvider, IDisposable {
    /**
     * This will trigger the view to update the changed element/root and its children recursively (if shown).
     * To signal that root has changed, do not pass any argument or pass `undefined` or `null`.
     */
    public readonly onDidChangeTreeData: Event<TestTreeItem | undefined>;

    private _onDidChangeTreeData: EventEmitter<TestTreeItem | undefined> = new EventEmitter<TestTreeItem | undefined>();
    private root: TestTreeItem[];
    private disposables: IDisposable[] = [];

    constructor(
        @inject(ITestCollectionStorageService) private testStore: ITestCollectionStorageService,
        @inject(IWorkspaceService) private workspace: IWorkspaceService,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry
    ) {
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.root = [new TestTreeItem(TestTreeItemType.Root, undefined, undefined, '*', 'no tests discovered yet', TestStatus.Unknown, undefined)];
        this.refresh(this.workspace.workspaceFolders[0].uri);
        disposableRegistry.push(this);
        this.disposables.push(this.testStore.onUpdated(this.onTestStoreUpdated, this));
    }

    // tslint:disable-next-line:no-empty
    public dispose() {
        this.disposables.forEach(d => d.dispose());
        this._onDidChangeTreeData.dispose();
    }

    /**
     * Get [TreeItem](#TreeItem) representation of the `element`
     *
     * @param element The element for which [TreeItem](#TreeItem) representation is asked for.
     * @return [TreeItem](#TreeItem) representation of the element
     */
    public async getTreeItem(element: TestTreeItem): Promise<TestTreeItem> {
        return element;
    }

    /**
     * Get the children of `element` or root if no element is passed.
     *
     * @param element The element from which the provider gets children. Can be `undefined`.
     * @return Children of `element` or root if no element is passed.
     */
    public getChildren(element?: TestTreeItem): ProviderResult<TestTreeItem[]> {
        if (element === undefined) {
            return this.root;
        }
        return element.children;
    }

    /**
     * Optional method to return the parent of `element`.
     * Return `null` or `undefined` if `element` is a child of root.
     *
     * **NOTE:** This method should be implemented in order to access [reveal](#TreeView.reveal) API.
     *
     * @param element The element for which the parent has to be returned.
     * @return Parent of `element`.
     */
    public getParent?(element: TestTreeItem): ProviderResult<TestTreeItem> {
        return element.parent;
    }

    /**
     * Refresh the view by rebuilding the model and signalling the tree view to update itself.
     *
     */
    public refresh(resource: Resource, tests?: Tests): void {

        if (tests === undefined) {
            tests = this.testStore.getTests(resource);
        }
        if (tests && tests.testFolders) {
            const newRoot: TestTreeItem[] = [];
            tests.testFolders.forEach((tf: TestFolder) => {
                newRoot.push(TestTreeItem.createFromFolder(tf));
            });
            this.root = newRoot;
            this._onDidChangeTreeData.fire();
        }
    }

    @traceDecorators.verbose('>>>  DEREK >>> Test store is being updated...')
    private onTestStoreUpdated(workspace: Uri): void {
        this.refresh(workspace);
    }
}
