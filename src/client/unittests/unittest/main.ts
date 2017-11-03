'use strict';
import * as vscode from 'vscode';
import { Product } from '../../common/installer';
import { BaseTestManager } from '../common/baseTestManager';
import { ITestCollectionStorageService, ITestDebugLauncher, ITestResultsService, ITestsHelper, Tests, TestStatus, TestsToRun } from '../common/types';
import { discoverTests } from './collector';
import { runTest } from './runner';
export class TestManager extends BaseTestManager {
    constructor(rootDirectory: string, outputChannel: vscode.OutputChannel,
        testCollectionStorage: ITestCollectionStorageService,
        testResultsService: ITestResultsService, testsHelper: ITestsHelper, private debugLauncher: ITestDebugLauncher) {
        super('unittest', Product.unittest, rootDirectory, outputChannel, testCollectionStorage, testResultsService, testsHelper);
    }
    // tslint:disable-next-line:no-empty
    public configure() {
    }
    public async discoverTestsImpl(ignoreCache: boolean): Promise<Tests> {
        const args = this.settings.unitTest.unittestArgs.slice(0);
        // tslint:disable-next-line:no-non-null-assertion
        return discoverTests(this.rootDirectory, args, this.testDiscoveryCancellationToken!, ignoreCache, this.outputChannel, this.testsHelper);
    }
    public async runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<{}> {
        const args = this.settings.unitTest.unittestArgs.slice(0);
        if (runFailedTests === true) {
            testsToRun = { testFile: [], testFolder: [], testSuite: [], testFunction: [] };
            testsToRun.testFunction = tests.testFunctions.filter(fn => {
                return fn.testFunction.status === TestStatus.Error || fn.testFunction.status === TestStatus.Fail;
            }).map(fn => fn.testFunction);
        }
        return runTest(this, this.testResultsService, this.debugLauncher, this.rootDirectory, tests, args, testsToRun, this.testRunnerCancellationToken, this.outputChannel, debug);
    }
}
