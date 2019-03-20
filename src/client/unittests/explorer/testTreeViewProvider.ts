// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Event, EventEmitter, TreeItem, Uri } from 'vscode';
import { ICommandManager, IWorkspaceService } from '../../common/application/types';
import { Commands } from '../../common/constants';
import { IDisposable, IDisposableRegistry } from '../../common/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { CommandSource } from '../common/constants';
import { getChildren, getParent } from '../common/testUtils';
import { ITestCollectionStorageService, TestStatus } from '../common/types';
import { ITestDataItemResource, ITestTreeViewProvider, IUnitTestManagementService, TestDataItem, TestWorkspaceFolder, WorkspaceTestStatus } from '../types';
import { TestTreeItem } from './testTreeViewItem';

@injectable()
export class TestTreeViewProvider implements ITestTreeViewProvider, ITestDataItemResource, IDisposable {
    public readonly onDidChangeTreeData: Event<TestDataItem | undefined>;
    public readonly discovered = new Set<string>();
    public readonly testsAreBeingDiscovered: Map<string, boolean>;

    private _onDidChangeTreeData = new EventEmitter<TestDataItem | undefined>();
    private disposables: IDisposable[] = [];

    constructor(
        @inject(ITestCollectionStorageService) private testStore: ITestCollectionStorageService,
        @inject(IUnitTestManagementService) private testService: IUnitTestManagementService,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry
    ) {
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;

        disposableRegistry.push(this);
        this.testsAreBeingDiscovered = new Map<string, boolean>();
        this.disposables.push(this.testService.onDidStatusChange(this.onTestStatusChanged, this));
        this.testStore.onDidChange(e => this._onDidChangeTreeData.fire(e.data), this, this.disposables);
        this.workspace.onDidChangeWorkspaceFolders(() => this._onDidChangeTreeData.fire(), this, this.disposables);

        if (Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0) {
            this.refresh(workspace.workspaceFolders[0].uri);
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
    public getResource(testData: Readonly<TestDataItem>): Uri {
        return testData.resource;
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
    public async getTreeItem(element: TestDataItem): Promise<TreeItem> {
        return new TestTreeItem(element.resource, element);
    }

    /**
     * Get the children of `element` or root if no element is passed.
     *
     * @param element The element from which the provider gets children. Can be `undefined`.
     * @return Children of `element` or root if no element is passed.
     */
    public async getChildren(element?: TestDataItem): Promise<TestDataItem[]> {
        if (element) {
            if (element instanceof TestWorkspaceFolder) {
                let tests = this.testStore.getTests(element.workspaceFolder.uri);
                if (!tests && !this.discovered.has(element.workspaceFolder.uri.fsPath)) {
                    this.discovered.add(element.workspaceFolder.uri.fsPath);
                    await this.commandManager.executeCommand(Commands.Tests_Discover, element, CommandSource.testExplorer, undefined);
                    tests = this.testStore.getTests(element.workspaceFolder.uri);
                }
                return tests ? tests.rootTestFolders : [];
            }
            return getChildren(element!);
        }

        if (!Array.isArray(this.workspace.workspaceFolders) || this.workspace.workspaceFolders.length === 0) {
            return [];
        }

        sendTelemetryEvent(EventName.UNITTEST_EXPLORER_WORK_SPACE_COUNT, undefined, { count: this.workspace.workspaceFolders.length });

        // If we are in a single workspace
        if (this.workspace.workspaceFolders.length === 1) {
            const tests = this.testStore.getTests(this.workspace.workspaceFolders[0].uri);
            return tests ? tests.rootTestFolders : [];
        }

        // If we are in a mult-root workspace, then nest the test data within a
        // virtual node, represending the workspace folder.
        return this.workspace.workspaceFolders
            .map(workspaceFolder => new TestWorkspaceFolder(workspaceFolder));
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
    public async getParent(element: TestDataItem): Promise<TestDataItem | undefined> {
        if (element instanceof TestWorkspaceFolder) {
            return;
        }
        const tests = this.testStore.getTests(element.resource);
        return tests ? getParent(tests, element) : undefined;
    }

    /**
     * Refresh the view by rebuilding the model and signaling the tree view to update itself.
     *
     * @param resource The resource 'root' for this refresh to occur under.
     */
    public refresh(resource: Uri): void {
        const workspaceFolder = this.workspace.getWorkspaceFolder(resource);
        if (!workspaceFolder) {
            return;
        }
        const tests = this.testStore.getTests(resource);
        if (tests && tests.testFolders) {
            this._onDidChangeTreeData.fire(new TestWorkspaceFolder(workspaceFolder));
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
            this.testsAreBeingDiscovered.set(e.workspace.fsPath, true);
            return;
        }
        if (!this.testsAreBeingDiscovered.get(e.workspace.fsPath)) {
            return;
        }
        this.testsAreBeingDiscovered.set(e.workspace.fsPath, false);
        this.refresh(e.workspace);
    }
}
