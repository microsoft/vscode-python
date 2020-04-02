// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Uri } from 'vscode';
import { scripts as internalScripts } from '../../../common/process/internal';
import { Tests } from '../types';

export type DiscoveredTests = internalScripts.testing_tools.DiscoveredTests;
export type Test = internalScripts.testing_tools.Test;
export type TestFolder = internalScripts.testing_tools.TestFolder;
export type TestFile = internalScripts.testing_tools.TestFile;
export type TestSuite = internalScripts.testing_tools.TestSuite;
export type TestFunction = internalScripts.testing_tools.TestFunction;

export const ITestDiscoveredTestParser = Symbol('ITestDiscoveredTestParser');
export interface ITestDiscoveredTestParser {
    parse(resource: Uri, discoveredTests: DiscoveredTests[]): Tests;
}
