// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Uri } from 'vscode';
import { Tests } from '../types';

export type TestContainer = {
    id: string;
    kind: 'file' | 'folder' | 'suite' | 'function';
    name: string;
    parentid: string;
};
export type TestItem = {
    id: string;
    name: string;
    source: string;
    parentid: string;
};
export type DiscoveredTests = {
    rootid: string;
    root: string;
    parents: TestContainer[];
    tests: TestItem[];
};

export const ITestDiscoveredTestParser = Symbol('ITestDiscoveredTestParser');
export interface ITestDiscoveredTestParser {
    parse(resource: Uri, discoveredTests: DiscoveredTests[]): Tests;
}
