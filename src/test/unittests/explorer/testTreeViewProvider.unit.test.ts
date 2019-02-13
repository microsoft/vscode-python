// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { IDisposable } from '../../../client/common/types';
import { TestDataItem } from '../../../client/providers/types';
import { TestStatus } from '../../../client/unittests/common/types';
import {
    TestTreeViewProvider
} from '../../../client/unittests/explorer/testTreeViewProvider';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';
import {
    createMockTestExplorer, createMockTestsData
} from './explorerTestData';

// Issuing the command pallette command(s) and observing when:
//     A test file is added/removed/renamed
//     A test suite is added/removed/renamed
//     A test function is added/removed/renamed
//     A test function was successful but has started to failed
//     A test function was failing but has started to succeed
//     A test function was skipped but is now being run successfully
//     A test function was skipped but is now being run unsuccessfully
//     A test function was running but is now being skipped
//     All the above state changes for functions, applied to suites (can Python suites be skipped?)

/**
 * Class that is useful to track any Tree View update requests made by the view provider.
 */
class TestExplorerCaptureRefresh implements IDisposable {
    public refreshCount = 0; // this counts the number of times 'onDidChangeTreeData' is emitted.

    private disposable: IDisposable;

    constructor(private testViewProvider: TestTreeViewProvider, disposableContainer: IDisposable[]) {
        this.disposable = this.testViewProvider.onDidChangeTreeData(this.onRefreshOccured, this);
        disposableContainer.push(this);
    }

    public dispose() {
        this.disposable.dispose();
    }

    private onRefreshOccured(testDataItem: TestDataItem) {
        this.refreshCount += 1;
    }
}

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests Test Explorer TestTreeViewProvider', () => {
    const testResource: Uri = Uri.parse(EXTENSION_ROOT_DIR_FOR_TESTS);
    let disposables: IDisposable[] = [];

    teardown(() => {
        disposables.forEach((disposableItem: IDisposable) => {
            disposableItem.dispose();
        });
        disposables = [];
    });

    test('Create the initial view and ensure it provides a default view', async () => {
        const testExplorer = createMockTestExplorer();
        expect(testExplorer).is.not.equal(
            undefined, 'Could not create a mock test explorer, check the parameters of the test setup.'
        );
        const treeRoot = testExplorer.getChildren();
        expect(treeRoot.length).to.be.greaterThan(
            0, 'No children returned from default view of the TreeViewProvider.'
        );
    });

    test('Ensure that updates from the test manager propagate to the TestExplorer', function () {
        // tslint:disable-next-line:no-invalid-this
        return this.skip();

        // const testsData = createMockTestsData();
        // const changeItem = testsData.testFolders[0].testFiles[0].functions[0];
        // const testExplorer = createMockTestExplorer(undefined, testsData);
        // const refreshCap = new TestExplorerCaptureRefresh(testExplorer, disposables);

        // testExplorer.refresh(testResource);
        // const originalTreeItem = await testExplorer.getTreeItem(changeItem);
        // const origToolTip = originalTreeItem.tooltip;

        // changeItem.status = TestStatus.Fail;
        // testExplorer.refresh(testResource);
        // const changedTreeItem = await testExplorer.getTreeItem(changeItem);
        // const changedToolTip = changedTreeItem.tooltip;

        // expect(origToolTip).to.not.equal(changedToolTip);
        // expect(refreshCap.refreshCount).to.equal(2);
    });

    test('When the test data is updated, the update event is emitted', () => {
        const testView = createMockTestExplorer();

        const refreshCap = new TestExplorerCaptureRefresh(testView, disposables);

        testView.refresh(testResource);

        expect(refreshCap.refreshCount).to.be.equal(1);
    });
});
