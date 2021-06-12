// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestItem } from 'vscode';
import { RawDiscoveredTests } from '../../common/services/types';
import { TestDiscoveryOptions } from '../../common/types';
import { TestCase } from './testCase';
import { TestCollection } from './testCollection';
import { TestFile } from './testFile';
import { TestFolder } from './testFolder';
import { WorkspaceTestRoot } from './workspaceTestRoot';

export type PythonTestData = WorkspaceTestRoot | TestFolder | TestFile | TestCollection | TestCase;

export const ITestDiscovery = Symbol('ITestDiscovery');
export interface ITestDiscovery {
    /**
     * Runs test discovery for the entire workspace.
     * @param {TestDiscoveryOptions} options
     */
    discoverWorkspaceTests(options: TestDiscoveryOptions): Promise<TestItem<PythonTestData> | undefined>;
}

export const ITestDiscoveryHelper = Symbol('ITestDiscoveryHelper');
export interface ITestDiscoveryHelper {
    runTestDiscovery(options: TestDiscoveryOptions): Promise<RawDiscoveredTests[]>;
}
