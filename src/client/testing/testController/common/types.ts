// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, TestItem, TestRunRequest, Uri, WorkspaceFolder } from 'vscode';
import { RawDiscoveredTests } from '../../common/services/types';
import { TestDiscoveryOptions } from '../../common/types';
import { TestCase } from './testCase';
import { TestCollection } from './testCollection';
import { TestFile } from './testFile';
import { TestFolder } from './testFolder';
import { WorkspaceTestRoot } from './workspaceTestRoot';

export type PythonRunnableTestData = TestFolder | TestFile | TestCollection | TestCase;
export type PythonTestData = WorkspaceTestRoot | PythonRunnableTestData;

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

export const ITestController = Symbol('ITestController');
export interface ITestController {
    createWorkspaceTests(
        workspace: WorkspaceFolder,
        token: CancellationToken,
    ): Promise<TestItem<PythonTestData> | undefined>;
    runTests(request: TestRunRequest<PythonTestData>, token: CancellationToken): Promise<void>;
}

export const ITestsRunner = Symbol('ITestsRunner');
export interface ITestsRunner {
    runTests(request: TestRunRequest<PythonTestData>, options: TestRunOptions): Promise<void>;
}

export type TestRunOptions = {
    workspaceFolder: Uri;
    cwd: string;
    args: string[];
    token: CancellationToken;
};
