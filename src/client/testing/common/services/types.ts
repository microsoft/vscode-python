// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Uri } from 'vscode';
import * as internalScripts from '../../../common/process/internal/scripts';
import { Tests } from '../types';

// We expose these here as a convenience and to cut down on churn
// elsewhere in the code.
export type DiscoveredTests = internalScripts.testingTools.DiscoveredTests;
export type Test = internalScripts.testingTools.Test;
export type TestFolder = internalScripts.testingTools.TestFolder;
export type TestFile = internalScripts.testingTools.TestFile;
export type TestSuite = internalScripts.testingTools.TestSuite;
export type TestFunction = internalScripts.testingTools.TestFunction;

export const ITestDiscoveredTestParser = Symbol('ITestDiscoveredTestParser');
export interface ITestDiscoveredTestParser {
    parse(resource: Uri, discoveredTests: DiscoveredTests[]): Tests;
}
