// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import 'reflect-metadata';
import { OutputChannel, Uri } from 'vscode';
import { IOutputChannel } from '../../client/common/types';
import { IServiceContainer, IServiceManager } from '../../client/ioc/types';
import { TEST_OUTPUT_CHANNEL } from '../../client/unittests/common/constants';
import { DebugLauncher } from '../../client/unittests/common/debugLauncher';
import { TestCollectionStorageService } from '../../client/unittests/common/services/storageService';
import { TestManagerService } from '../../client/unittests/common/services/testManagerService';
import { TestResultsService } from '../../client/unittests/common/services/testResultsService';
import { WorkspaceTestManagerService } from '../../client/unittests/common/services/workspaceTestManagerService';
import { TestsHelper } from '../../client/unittests/common/testUtils';
import { TestFlatteningVisitor } from '../../client/unittests/common/testVisitors/flatteningVisitor';
import { TestFolderGenerationVisitor } from '../../client/unittests/common/testVisitors/folderGenerationVisitor';
import { TestResultResetVisitor } from '../../client/unittests/common/testVisitors/resultResetVisitor';
import {
    ITestCollectionStorageService,
    ITestDebugLauncher,
    ITestManager,
    ITestManagerFactory,
    ITestManagerService,
    ITestManagerServiceFactory,
    ITestResultsService,
    ITestsHelper,
    ITestVisitor,
    IWorkspaceTestManagerService,
    TestProvider
} from '../../client/unittests/common/types';
import { TestManager as NoseTestManager } from '../../client/unittests/nosetest/main';
import { TestManager as PyTestTestManager } from '../../client/unittests/pytest/main';
import { TestManager as UnitTestTestManager } from '../../client/unittests/unittest/main';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<ITestDebugLauncher>(ITestDebugLauncher, DebugLauncher);
    serviceManager.addSingleton<ITestCollectionStorageService>(ITestCollectionStorageService, TestCollectionStorageService);
    serviceManager.addSingleton<IWorkspaceTestManagerService>(IWorkspaceTestManagerService, WorkspaceTestManagerService);

    serviceManager.add<ITestsHelper>(ITestsHelper, TestsHelper);
    serviceManager.add<ITestResultsService>(ITestResultsService, TestResultsService);

    serviceManager.add<ITestVisitor>(ITestVisitor, TestFlatteningVisitor, 'TestFlatteningVisitor');
    serviceManager.add<ITestVisitor>(ITestVisitor, TestFolderGenerationVisitor, 'TestFolderGenerationVisitor');
    serviceManager.add<ITestVisitor>(ITestVisitor, TestResultResetVisitor, 'TestResultResetVisitor');

    serviceManager.addFactory<ITestManager>(ITestManagerFactory, (context) => {
        return (testProvider: TestProvider, workspaceFolder: Uri, rootDirectory: string) => {
            const serviceContainer = context.container.get<IServiceContainer>(IServiceContainer);
            const outputChannel = context.container.getNamed<OutputChannel>(IOutputChannel, TEST_OUTPUT_CHANNEL);
            const testCollectionStorage = context.container.get<ITestCollectionStorageService>(ITestCollectionStorageService);
            const testResultsService = context.container.get<ITestResultsService>(ITestResultsService);

            switch (testProvider) {
                case 'nosetest': {
                    return new NoseTestManager(workspaceFolder, rootDirectory, outputChannel, testCollectionStorage, testResultsService, serviceContainer);
                }
                case 'pytest': {
                    return new PyTestTestManager(workspaceFolder, rootDirectory, outputChannel, testCollectionStorage, testResultsService, serviceContainer);
                }
                case 'unittest': {
                    return new UnitTestTestManager(workspaceFolder, rootDirectory, outputChannel, testCollectionStorage, testResultsService, serviceContainer);
                }
                default: {
                    throw new Error(`Unrecognized test provider '${testProvider}'`);
                }
            }
        };
    });

    serviceManager.addFactory<ITestManagerService>(ITestManagerServiceFactory, (context) => {
        return (workspaceFolder: Uri) => {
            const serviceContainer = context.container.get<IServiceContainer>(IServiceContainer);
            const testsHelper = context.container.get<ITestsHelper>(ITestsHelper);
            return new TestManagerService(workspaceFolder, testsHelper, serviceContainer);
        };
    });
}
