// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import 'reflect-metadata';
import { OutputChannel, Uri } from 'vscode';
import { IOutputChannel } from '../common/types';
import { IServiceContainer, IServiceManager } from '../ioc/types';
import { TEST_OUTPUT_CHANNEL } from './common/constants';
import { DebugLauncher } from './common/debugLauncher';
import { TestCollectionStorageService } from './common/services/storageService';
import { TestManagerService } from './common/services/testManagerService';
import { TestResultsService } from './common/services/testResultsService';
import { WorkspaceTestManagerService } from './common/services/workspaceTestManagerService';
import { TestsHelper } from './common/testUtils';
import { TestFlatteningVisitor } from './common/testVisitors/flatteningVisitor';
import { TestFolderGenerationVisitor } from './common/testVisitors/folderGenerationVisitor';
import { TestResultResetVisitor } from './common/testVisitors/resultResetVisitor';
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
} from './common/types';
import { TestManager as NoseTestManager } from './nosetest/main';
import { TestManager as PyTestTestManager } from './pytest/main';
import { TestManager as UnitTestTestManager } from './unittest/main';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<ITestDebugLauncher>(ITestDebugLauncher, DebugLauncher);
    serviceManager.addSingleton<ITestsHelper>(ITestsHelper, TestsHelper);
    serviceManager.addSingleton<ITestResultsService>(ITestResultsService, TestResultsService);
    serviceManager.addSingleton<ITestCollectionStorageService>(ITestCollectionStorageService, TestCollectionStorageService);

    serviceManager.addSingleton<ITestVisitor>(ITestVisitor, TestFlatteningVisitor, 'TestFlatteningVisitor');
    serviceManager.addSingleton<ITestVisitor>(ITestVisitor, TestFolderGenerationVisitor, 'TestFolderGenerationVisitor');
    serviceManager.addSingleton<ITestVisitor>(ITestVisitor, TestResultResetVisitor, 'TestResultResetVisitor');

    serviceManager.addSingleton<IWorkspaceTestManagerService>(IWorkspaceTestManagerService, WorkspaceTestManagerService);

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
