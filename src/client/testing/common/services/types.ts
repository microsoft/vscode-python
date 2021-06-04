// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Uri } from 'vscode';
import { Tests } from '../types';

// We expose these here as a convenience and to cut down on churn
// elsewhere in the code.
type RawTestNode = {
    id: string;
    name: string;
    parentid: string;
};
type RawTestParent = RawTestNode & {
    kind: 'folder' | 'file' | 'suite' | 'function';
};
type RawTestFSNode = RawTestParent & {
    kind: 'folder' | 'file';
    relpath: string;
};

export type RawTestFolder = RawTestFSNode & {
    kind: 'folder';
};
export type RawTestFile = RawTestFSNode & {
    kind: 'file';
};
export type RawTestSuite = RawTestParent & {
    kind: 'suite';
};
// function-as-a-container is for parameterized ("sub") tests.
export type RawTestFunction = RawTestParent & {
    kind: 'function';
};
export type RawTest = RawTestNode & {
    source: string;
};
export type RawDiscoveredTests = {
    rootid: string;
    root: string;
    parents: RawTestParent[];
    tests: RawTest[];
};

export const ITestDiscoveredTestParser = Symbol('ITestDiscoveredTestParser');
export interface ITestDiscoveredTestParser {
    parse(resource: Uri, discoveredTests: RawDiscoveredTests[]): Tests;
}
