'use strict';
import * as vscode from 'vscode';
import { Product } from '../../common/installer';
import { BaseTestManager } from '../common/baseTestManager';
import { ITestCollectionStorageService, ITestDebugLauncher, ITestResultsService, ITestsHelper, Tests, TestsToRun } from '../common/types';
import { discoverTests } from './collector';
import { runTest } from './runner';

export class TestManager extends BaseTestManager {
    constructor(rootDirectory: string, outputChannel: vscode.OutputChannel,
        testCollectionStorage: ITestCollectionStorageService,
        testResultsService: ITestResultsService, testsHelper: ITestsHelper, private debugLauncher: ITestDebugLauncher) {
        super('pytest', Product.pytest, rootDirectory, outputChannel, testCollectionStorage, testResultsService, testsHelper);
    }
    public discoverTestsImpl(ignoreCache: boolean): Promise<Tests> {
        const args = this.settings.unitTest.pyTestArgs.slice(0);
        return discoverTests(this.rootDirectory, args, this.testDiscoveryCancellationToken, ignoreCache, this.outputChannel, this.testsHelper);
    }
    public runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<{}> {
        const args = this.settings.unitTest.pyTestArgs.slice(0);
        if (runFailedTests === true && args.indexOf('--lf') === -1 && args.indexOf('--last-failed') === -1) {
            args.push('--last-failed');
        }
        return runTest(this.testResultsService, this.debugLauncher, this.rootDirectory, tests, args, testsToRun, this.testRunnerCancellationToken, this.outputChannel, debug);
    }
}
