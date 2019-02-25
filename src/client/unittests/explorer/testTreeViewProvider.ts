// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Event, EventEmitter, Uri } from 'vscode';
import { IWorkspaceService } from '../../common/application/types';
import { IDisposable, IDisposableRegistry } from '../../common/types';
import { getChildren, getParent } from '../common/testUtils';
import { ITestCollectionStorageService, TestStatus } from '../common/types';
import { ITestDataItemResource, ITestTreeViewProvider, IUnitTestManagementService, TestDataItem, WorkspaceTestStatus } from '../types';
import { createTreeViewItemFrom, TestTreeItem } from './testTreeViewItem';

@injectable()
export class TestTreeViewProvider implements ITestTreeViewProvider, ITestDataItemResource, IDisposable {
    public readonly onDidChangeTreeData: Event<TestDataItem | undefined>;

    private _onDidChangeTreeData = new EventEmitter<TestDataItem | undefined>();
    private testsAreBeingDiscovered: boolean = false;
    private disposables: IDisposable[] = [];

    constructor(
        @inject(ITestCollectionStorageService) private testStore: ITestCollectionStorageService,
        @inject(IUnitTestManagementService) private testService: IUnitTestManagementService,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry
    ) {
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;

        disposableRegistry.push(this);
        this.disposables.push(this.testService.onDidStatusChange(this.onTestStatusChanged, this));
        this.testStore.onDidChange(e => this._onDidChangeTreeData.fire(e.data), this, this.disposables);

        if (Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0) {
            this.refresh(workspace.workspaceFolders![0].uri);
        }
    }

    /**
     * We need a way to map a given TestDataItem to a Uri, so that other consumers (such
     * as the commandHandler for the Test Explorer) have a way of accessing the Uri outside
     * the purview off the TestTreeView.
     *
     * @param testData Test data item to map to a Uri
     * @returns A Uri representing the workspace that the test data item exists within
     */
    public getResource(_testData: Readonly<TestDataItem>): Uri {
        return this.workspace.workspaceFolders![0].uri;
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
        const resource = this.workspace.workspaceFolders![0].uri;
        const parent = await this.getParent!(element);
        return createTreeViewItemFrom(resource, element, parent);
    }

    /**
     * Get the children of `element` or root if no element is passed.
     *
     * @param element The element from which the provider gets children. Can be `undefined`.
     * @return Children of `element` or root if no element is passed.
     */
    public getChildren(element?: TestDataItem): TestDataItem[] {
        const resource = this.workspace.workspaceFolders![0].uri;
        const tests = this.testStore.getTests(resource);

        if (element === undefined) {
            return tests && tests.testFolders ? tests.rootTestFolders : [];
        }

        return getChildren(element);
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
        const resource = this.workspace.workspaceFolders![0].uri;
        const tests = this.testStore.getTests(resource)!;
        return getParent(tests, element)!;
    }

    /**
     * Refresh the view by rebuilding the model and signaling the tree view to update itself.
     *
     * @param resource The resource 'root' for this refresh to occur under.
     */
    public refresh(resource: Uri): void {
        const tests = this.testStore.getTests(resource);
        if (tests && tests.testFolders) {
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
}
