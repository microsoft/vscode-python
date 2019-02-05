// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import {
    Event, EventEmitter,
    ProviderResult, TreeDataProvider
} from 'vscode';
import {
    PythonTestTreeItem,
    PythonTestTreeItemType
} from './testTreeViewItem';

export class PythonTestTreeViewProvider implements TreeDataProvider<PythonTestTreeItem> {
    /**
     * This will trigger the view to update the changed element/root and its children recursively (if shown).
     * To signal that root has changed, do not pass any argument or pass `undefined` or `null`.
     */
    public readonly onDidChangeTreeData: Event<PythonTestTreeItem | undefined>;

    private _onDidChangeTreeData: EventEmitter<PythonTestTreeItem | undefined> = new EventEmitter<PythonTestTreeItem | undefined>();
    private root: PythonTestTreeItem[];

    constructor() {
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        // set up some dummy data to just show that the test explorer loads.
        this.root = this.getTestTree();
    }

    /**
     * Get [TreeItem](#TreeItem) representation of the `element`
     *
     * @param element The element for which [TreeItem](#TreeItem) representation is asked for.
     * @return [TreeItem](#TreeItem) representation of the element
     */
    public async getTreeItem(element: PythonTestTreeItem): Promise<PythonTestTreeItem> {
        return element;
    }

    /**
     * Get the children of `element` or root if no element is passed.
     *
     * @param element The element from which the provider gets children. Can be `undefined`.
     * @return Children of `element` or root if no element is passed.
     */
    public getChildren(element?: PythonTestTreeItem): ProviderResult<PythonTestTreeItem[]> {
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
    public getParent?(element: PythonTestTreeItem): ProviderResult<PythonTestTreeItem> {
        return element.parent;
    }

    private getTestTree(): PythonTestTreeItem[] {
        // create a sample tree just to get the feature up and running
        const roots: PythonTestTreeItem[] = [];
        const root1: PythonTestTreeItem = new PythonTestTreeItem(PythonTestTreeItemType.Root, undefined, [], '/test', '/test');
        roots.push(root1);

        const root1_pkg1: PythonTestTreeItem = new PythonTestTreeItem(PythonTestTreeItemType.Package, root1, [], '/test/module1', 'module1');
        root1.children.push(root1_pkg1);

        const root1_pkg1_file1: PythonTestTreeItem = new PythonTestTreeItem(PythonTestTreeItemType.File, root1_pkg1, [], '/test/module1/test_file1.py', 'test_file1.py');
        root1_pkg1.children.push(root1_pkg1_file1);

        const root1_pkg1_file1_fn1: PythonTestTreeItem = new PythonTestTreeItem(PythonTestTreeItemType.Function, root1_pkg1_file1, undefined, '/test/module1/test_file1.py::test_function_1', 'test_function_1');
        root1_pkg1_file1.children.push(root1_pkg1_file1_fn1);

        const root1_pkg1_file1_fn2: PythonTestTreeItem = new PythonTestTreeItem(PythonTestTreeItemType.Function, root1_pkg1_file1, undefined, '/test/module1/test_file1.py::test_function_2', 'test_function_2');
        root1_pkg1_file1.children.push(root1_pkg1_file1_fn2);

        const root1_pkg1_file1_suite1: PythonTestTreeItem = new PythonTestTreeItem(PythonTestTreeItemType.Suite, root1_pkg1_file1, [], '/test/module1/test_file1.py::TestSuite1', 'TestSuite1');
        root1_pkg1_file1.children.push(root1_pkg1_file1_suite1);

        const root1_pkg1_file1_suite1_fn1: PythonTestTreeItem = new PythonTestTreeItem(PythonTestTreeItemType.Function, root1_pkg1_file1_suite1, undefined, '/test/module1/test_file1.py::TestSuite1::test_suite1_fn1', 'test_suite1_fn1');
        root1_pkg1_file1_suite1.children.push(root1_pkg1_file1_suite1_fn1);

        const root1_pkg1_file1_suite1_fn2: PythonTestTreeItem = new PythonTestTreeItem(PythonTestTreeItemType.Function, root1_pkg1_file1_suite1, undefined, '/test/module1/test_file1.py::TestSuite1::test_suite1_fn2', 'test_suite1_fn2');
        root1_pkg1_file1_suite1.children.push(root1_pkg1_file1_suite1_fn2);

        const root1_pkg1_file1_suite2: PythonTestTreeItem = new PythonTestTreeItem(PythonTestTreeItemType.Suite, root1_pkg1_file1, [], '/test/module1/test_file1.py::TestSuite2', 'TestSuite2');
        root1_pkg1_file1.children.push(root1_pkg1_file1_suite2);

        const root1_pkg1_file1_suite2_fn1: PythonTestTreeItem = new PythonTestTreeItem(PythonTestTreeItemType.Function, root1_pkg1_file1_suite2, undefined, '/test/module1/test_file1.py::TestSuite2::test_suite2_fn1', 'test_suite2_fn1');
        root1_pkg1_file1_suite2.children.push(root1_pkg1_file1_suite2_fn1);

        const root1_pkg1_file1_suite2_fn2: PythonTestTreeItem = new PythonTestTreeItem(PythonTestTreeItemType.Function, root1_pkg1_file1_suite2, undefined, '/test/module1/test_file1.py::TestSuite2::test_suite2_fn2', 'test_suite2_fn2');
        root1_pkg1_file1_suite2.children.push(root1_pkg1_file1_suite2_fn2);

        return roots;
    }
}
