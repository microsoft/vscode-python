// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Event, EventEmitter, Uri } from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import {
    IDisposable, IDisposableRegistry, Resource
} from '../../common/types';
import {
    ITestCollectionStorageService,
    TestFolder, Tests, TestStatus
} from '../common/types';
import {
    ITestDataItemResource, ITestTreeViewProvider,
    IUnitTestManagementService, TestDataItem,
    WorkspaceTestStatus
} from '../types';
import {
    createTreeViewItemFrom, TestFolderTreeItem, TestTreeItem
} from './testTreeViewItem';

@injectable()
export class TestTreeViewProvider implements ITestTreeViewProvider, ITestDataItemResource, IDisposable {
    // VS Code API point to refresh the tree view recursively...
    public readonly onDidChangeTreeData: Event<TestDataItem | undefined>;

    private _onDidChangeTreeData: EventEmitter<TestDataItem | undefined> = new EventEmitter<TestDataItem | undefined>();
    private testsAreBeingDiscovered: boolean = false;
    private root: TestTreeItem[];
    private disposables: IDisposable[] = [];
    private cachedItems: Map<TestDataItem, TestTreeItem> = new Map<TestDataItem, TestTreeItem>();

    constructor(
        @inject(ITestCollectionStorageService) private testStore: ITestCollectionStorageService,
        @inject(IUnitTestManagementService) private testService: IUnitTestManagementService,
        @inject(IWorkspaceService) workspace: IWorkspaceService,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry
    ) {
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;

        // Create a dummy item to display 'No Tests Found' in the explorer to start with.
        const m: TestFolder = {
            name: 'NoTestsFound',
            nameToRun: 'NoTestsFound',
            status: TestStatus.Unknown,
            testFiles: [],
            time: 0,
            folders: []
        };
        this.root = [new TestFolderTreeItem(undefined, undefined, m)];

        this.cachedItems.set(m, this.root[0]);
        if (workspace.workspaceFolders.length > 0) {
            this.refresh(workspace.workspaceFolders[0].uri);
        }
        disposableRegistry.push(this);
        this.disposables.push(this.testService.onDidStatusChange(this.onTestStatusChanged, this));
    }

    /**
     * We need a way to map a given TestDataItem to a Uri, so that other consumers (such
     * as the commandHandler for the Test Explorer) have a way of accessing the Uri outside
     * the purview off the TestTreeView.
     *
     * @param testData Test data item to map to a Uri
     * @returns A Uri representing the workspace that the test data item exists within
     */
    public getResource(testData: Readonly<TestDataItem>): Uri {

        if (this.cachedItems.has(testData)) {
            const testViewItem: Readonly<TestTreeItem> = this.cachedItems.get(testData);
            return testViewItem.resource;
        }

        throw new Error(`Test data item for ${testData.nameToRun} does not exist in the Tree View for the Test Explorer.`);
    }

    /**
     * As the TreeViewProvider itself is getting disposed, ensure all registered listeners are disposed
     * from our internal emitter.
     */
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
    public async getTreeItem(element: TestDataItem): Promise<TestTreeItem> {
        if (this.cachedItems.has(element)) {
            return this.cachedItems.get(element);
        }
        return undefined;
    }

    /**
     * Get the children of `element` or root if no element is passed.
     *
     * @param element The element from which the provider gets children. Can be `undefined`.
     * @return Children of `element` or root if no element is passed.
     */
    public getChildren(element?: TestDataItem): TestDataItem[] {
        if (element === undefined) {
            return this.root.map((treeItem: TestTreeItem) => treeItem.data);
        }

        const viewItem: TestTreeItem = this.cachedItems.get(element);
        const children: TestTreeItem[] = viewItem.children;

        return children.map((treeItem: TestTreeItem) => treeItem.data);
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
    public async getParent?(element: TestDataItem): Promise<TestDataItem> {
        const treeEl: TestTreeItem = this.cachedItems.get(element);
        const parentEl: TestTreeItem = this.cachedItems.get(treeEl.parent);
        return parentEl ? parentEl.data : undefined;
    }

    /**
     * Refresh the view by rebuilding the model and signaling the tree view to update itself.
     *
     * @param resource The resource 'root' for this refresh to occur under.
     */
    public refresh(resource: Resource): void {

        const tests: Tests = this.testStore.getTests(resource);
        if (tests && tests.testFolders) {
            const newRoot: TestTreeItem[] = [];
            const newCache: Map<TestDataItem, TestTreeItem> = new Map<TestDataItem, TestTreeItem>();
            tests.rootTestFolders.forEach((tf: TestFolder) => {
                const rootItem: TestTreeItem = createTreeViewItemFrom(resource, tf, undefined);
                newCache.set(tf, rootItem);
                newRoot.push(rootItem);
                this.cacheEntireTree(rootItem, newCache);
            });
            this.root = newRoot;
            this.cachedItems = newCache;
            this._onDidChangeTreeData.fire();
        }
    }

    /**
     * Event handler for TestStatusChanged (coming from the IUnitTestManagementService).
     * ThisThe TreeView needs to know when we begin discovery and when discovery completes.
     *
     * @param e The event payload containing context for the status change
     */
    private onTestStatusChanged(e: WorkspaceTestStatus) {
        if (e.status === TestStatus.Discovering) {
            this.testsAreBeingDiscovered = true;
            return;
        }
        if (this.testsAreBeingDiscovered) {
            this.testsAreBeingDiscovered = false;
            this.refresh(e.workspace);
        }
    }

    /**
     * Build the entire tree of TreeViewItems and cache them.
     *
     * This is to supply our tree with the `getParent` call, so that we can get the
     * `reveal` API to work. Until we start calling `reveal` this will likely not get
     * called at all.
     *
     * @param root Root item to traverse from and rebuild the TreeView cache from
     */
    private cacheEntireTree(root: TestTreeItem, cache: Map<TestDataItem, TestTreeItem>): void {
        root.children.forEach((child: TestTreeItem) => {
            cache.set(child.data, child);
            this.cacheEntireTree(child, cache);
        });
    }
}
