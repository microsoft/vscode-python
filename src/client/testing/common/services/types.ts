// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Uri } from 'vscode';
import { Tests } from '../types';

export type TestNode = {
    id: string;
    name: string;
    parentid: string;
};
export type TestParent = TestNode & {
    kind: 'folder' | 'file' | 'suite' | 'function';
};
export type TestFSNode = TestParent & {
    kind: 'folder' | 'file';
    relpath: string;
};
export type TestFolder = TestFSNode & {
    kind: 'folder';
};
export type TestFile = TestFSNode & {
    kind: 'file';
};
export type TestSuite = TestParent & {
    kind: 'suite';
};
// function-as-a-container is for parameterized ("sub") tests.
export type TestFunction = TestParent & {
    kind: 'function';
};
export type Test = TestNode & {
    source: string;
};
export type DiscoveredTests = {
    rootid: string;
    root: string;
    parents: TestParent[];
    tests: Test[];
};

export const ITestDiscoveredTestParser = Symbol('ITestDiscoveredTestParser');
export interface ITestDiscoveredTestParser {
    parse(resource: Uri, discoveredTests: DiscoveredTests[]): Tests;
}
