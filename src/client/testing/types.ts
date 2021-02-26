// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { DocumentSymbolProvider } from 'vscode';
import { Product } from '../common/types';
import { TestSettingsPropertyNames } from './configuration/types';

export type TestProvider = 'nosetest' | 'pytest' | 'unittest';

// ****************
// interfaces

export const ITestingService = Symbol('ITestingService');
export interface ITestingService {
    activate(symbolProvider: DocumentSymbolProvider): Promise<void>;
    register(): void;
    getSettingsPropertyNames(product: Product): TestSettingsPropertyNames;
}
