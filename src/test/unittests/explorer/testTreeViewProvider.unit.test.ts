// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { createMockTestExplorer } from './explorerTestData';

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests Test Explorer TestTreeViewProvider', () => {

    test('Create the initial view and ensure it provides a default view', async () => {
        const testExplorer = createMockTestExplorer();
        expect(testExplorer).is.not.equal(undefined, 'Could not create a mock test explorer, check the parameters of the test setup.');
        const treeRoot = testExplorer.getChildren();
        expect(treeRoot.length).to.be.greaterThan(0, 'No children returned from default view of the TreeViewProvider.');
    });
});
