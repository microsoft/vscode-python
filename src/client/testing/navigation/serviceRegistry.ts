// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IDocumentSymbolProvider } from '../../common/types';
import { IServiceManager } from '../../ioc/types';
import { TestCodeNavigatorCommandHandler } from './commandHandler';
import { TestFileCodeNavigator } from './fileNavigator';
import { TestFunctionCodeNavigator } from './functionNavigator';
import { TestNavigatorHelper } from './helper';
import { TestSuiteCodeNavigator } from './suiteNavigator';
import { TestFileSymbolProvider } from './symbolProvider';
import { ITestCodeNavigator, ITestCodeNavigatorCommandHandler, ITestNavigatorHelper, NavigableItemType } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<ITestNavigatorHelper>(ITestNavigatorHelper, TestNavigatorHelper);
    serviceManager.addSingleton<ITestCodeNavigatorCommandHandler>(
        ITestCodeNavigatorCommandHandler,
        TestCodeNavigatorCommandHandler,
    );
    serviceManager.addSingleton<ITestCodeNavigator>(
        ITestCodeNavigator,
        TestFileCodeNavigator,
        NavigableItemType.testFile,
    );
    serviceManager.addSingleton<ITestCodeNavigator>(
        ITestCodeNavigator,
        TestFunctionCodeNavigator,
        NavigableItemType.testFunction,
    );
    serviceManager.addSingleton<ITestCodeNavigator>(
        ITestCodeNavigator,
        TestSuiteCodeNavigator,
        NavigableItemType.testSuite,
    );
    serviceManager.addSingleton<IDocumentSymbolProvider>(IDocumentSymbolProvider, TestFileSymbolProvider, 'test');
}
