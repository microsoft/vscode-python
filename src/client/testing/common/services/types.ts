// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Uri } from 'vscode';
import * as internalScripts from '../../../common/process/internal/scripts';
import { Tests } from '../types';

// We expose these here as a convenience and to cut down on churn
// elsewhere in the code.
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
