'use strict';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { Product } from '../../common/installer';
import { IServiceContainer } from '../../ioc/types';
import { BaseTestManager } from '../common/baseTestManager';
import { ITestCollectionStorageService, ITestDebugLauncher, ITestResultsService, ITestsHelper, TestDiscoveryOptions, TestRunOptions, Tests, TestStatus, TestsToRun } from '../common/types';
import { discoverTests } from './collector';
import { runTest } from './runner';
export class TestManager extends BaseTestManager {
    constructor(workspaceFolder: Uri, rootDirectory: string, outputChannel: vscode.OutputChannel,
        testCollectionStorage: ITestCollectionStorageService,
        testResultsService: ITestResultsService, testsHelper: ITestsHelper, private debugLauncher: ITestDebugLauncher,
        serviceContainer: IServiceContainer) {
        super('unittest', Product.unittest, workspaceFolder, rootDirectory, outputChannel, testCollectionStorage, testResultsService, testsHelper, serviceContainer);
    }
    // tslint:disable-next-line:no-empty
    public configure() {
    }
    public async discoverTestsImpl(ignoreCache: boolean): Promise<Tests> {
        const args = this.settings.unitTest.unittestArgs.slice(0);
        const options: TestDiscoveryOptions = {
            workspaceFolder: this.workspaceFolder,
            cwd: this.rootDirectory, args,
            token: this.testDiscoveryCancellationToken, ignoreCache,
            outChannel: this.outputChannel
        };
        // tslint:disable-next-line:no-non-null-assertion
        return discoverTests(this.serviceContainer, this.testsHelper, options);
    }
    public async runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<{}> {
        const args = this.settings.unitTest.unittestArgs.slice(0);
        if (runFailedTests === true) {
            testsToRun = { testFile: [], testFolder: [], testSuite: [], testFunction: [] };
            testsToRun.testFunction = tests.testFunctions.filter(fn => {
                return fn.testFunction.status === TestStatus.Error || fn.testFunction.status === TestStatus.Fail;
            }).map(fn => fn.testFunction);
        }
        const options: TestRunOptions = {
            workspaceFolder: this.workspaceFolder,
            cwd: this.rootDirectory,
            tests, args, testsToRun, debug,
            token: this.testRunnerCancellationToken,
            outChannel: this.outputChannel
        };
        return runTest(this.serviceContainer, this, this.testResultsService, this.debugLauncher, options);
    }
}
