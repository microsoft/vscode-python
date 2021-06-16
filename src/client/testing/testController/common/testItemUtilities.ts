// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestItem, Uri } from 'vscode';
import { traceVerbose } from '../../../common/logger';
import {
    RawDiscoveredTests,
    RawTestFile,
    RawTestFolder,
    RawTestFunction,
    RawTestSuite,
} from '../../common/services/types';
import { TestCase } from './testCase';
import { TestCollection } from './testCollection';
import { TestFile } from './testFile';
import { TestFolder } from './testFolder';
import { PythonTestData } from './types';
import { WorkspaceTestRoot } from './workspaceTestRoot';

export function updateTestRoot(
    root: TestItem<WorkspaceTestRoot>,
    rootData: RawDiscoveredTests,
): TestItem<WorkspaceTestRoot> {
    const parents = rootData.parents.map((p) => {
        let item;
        switch (p.kind) {
            case 'folder': {
                item = TestFolder.create(rootData.root, p as RawTestFolder);
                break;
            }
            case 'file': {
                item = TestFile.create(rootData.root, p as RawTestFile);
                break;
            }
            case 'suite': {
                item = TestCollection.create(rootData.root, p as RawTestSuite);
                break;
            }
            case 'function': {
                item = TestCollection.create(rootData.root, p as RawTestFunction);
                break;
            }
            default:
                traceVerbose('Unknown test node: ', p);
                break;
        }
        return item;
    });

    parents.forEach((testNode) => {
        if (testNode) {
            if (testNode.data.raw.parentid === rootData.rootid) {
                root.addChild(testNode);
                return;
            }

            const parent = parents.find((p) => {
                if (p) {
                    return p.data.raw.id === testNode.data.raw.parentid;
                }
                return false;
            });
            if (parent) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                parent.addChild(testNode as TestItem<any>);
            }
        }
    });

    const tests = rootData.tests.map((t) => TestCase.create(rootData.root, t));
    tests.forEach((testCase) => {
        const parent = parents.find((p) => {
            if (p) {
                return p.data.raw.id === testCase.data.raw.parentid;
            }
            return false;
        });
        if (parent) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            parent.addChild(testCase as TestItem<any>);
        }
    });

    return root;
}

export function getUri(node: TestItem<PythonTestData>): Uri | undefined {
    if (!node.uri && node.parent) {
        return getUri(node.parent);
    }
    return node.uri;
}
