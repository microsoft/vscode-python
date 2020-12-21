// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { use } from 'chai';
import * as chaisAsPromised from 'chai-as-promised';
import { anything, instance, mock, verify } from 'ts-mockito';
import { IDocumentSymbolProvider } from '../../../client/common/types';
import { ServiceManager } from '../../../client/ioc/serviceManager';
import { TestCodeNavigatorCommandHandler } from '../../../client/testing/navigation/commandHandler';
import { TestFileCodeNavigator } from '../../../client/testing/navigation/fileNavigator';
import { TestFunctionCodeNavigator } from '../../../client/testing/navigation/functionNavigator';
import { TestNavigatorHelper } from '../../../client/testing/navigation/helper';
import { registerTypes } from '../../../client/testing/navigation/serviceRegistry';
import { TestSuiteCodeNavigator } from '../../../client/testing/navigation/suiteNavigator';
import { TestFileSymbolProvider } from '../../../client/testing/navigation/symbolProvider';
import {
    ITestCodeNavigator,
    ITestCodeNavigatorCommandHandler,
    ITestNavigatorHelper,
    NavigableItemType,
} from '../../../client/testing/navigation/types';

use(chaisAsPromised);

suite('Unit Tests - Navigation Service Registry', () => {
    test('Ensure services are registered', async () => {
        const serviceManager = mock(ServiceManager);

        registerTypes(instance(serviceManager));

        verify(serviceManager.addSingleton<ITestNavigatorHelper>(ITestNavigatorHelper, TestNavigatorHelper)).once();
        verify(
            serviceManager.addSingleton<ITestCodeNavigatorCommandHandler>(
                ITestCodeNavigatorCommandHandler,
                TestCodeNavigatorCommandHandler,
            ),
        ).once();
        verify(
            serviceManager.addSingleton<ITestCodeNavigator>(
                ITestCodeNavigator,
                TestFileCodeNavigator,
                NavigableItemType.testFile,
            ),
        ).once();
        verify(
            serviceManager.addSingleton<ITestCodeNavigator>(
                ITestCodeNavigator,
                TestFunctionCodeNavigator,
                NavigableItemType.testFunction,
            ),
        ).once();
        verify(
            serviceManager.addSingleton<ITestCodeNavigator>(
                ITestCodeNavigator,
                TestSuiteCodeNavigator,
                NavigableItemType.testSuite,
            ),
        ).once();
        verify(serviceManager.addSingleton<IDocumentSymbolProvider>(anything(), TestFileSymbolProvider, 'test')).once();
    });
});
