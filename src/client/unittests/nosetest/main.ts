'use strict';
import { OutputChannel, Uri } from 'vscode';
import * as vscode from 'vscode';
import { PythonSettings } from '../../common/configSettings';
import { Product } from '../../common/installer';
import { IServiceContainer } from '../../ioc/types';
import { BaseTestManager } from '../common/baseTestManager';
import { ITestCollectionStorageService, ITestDebugLauncher, ITestResultsService, ITestsHelper, TestDiscoveryOptions, TestRunOptions, Tests, TestsToRun } from '../common/types';
import { discoverTests } from './collector';
import { runTest } from './runner';

export class TestManager extends BaseTestManager {
    constructor(workspaceFolder: Uri, rootDirectory: string, outputChannel: vscode.OutputChannel,
        testCollectionStorage: ITestCollectionStorageService,
        testResultsService: ITestResultsService, testsHelper: ITestsHelper, private debugLauncher: ITestDebugLauncher,
        serviceContainer: IServiceContainer) {
        super('nosetest', Product.nosetest, workspaceFolder, rootDirectory, outputChannel, testCollectionStorage, testResultsService, testsHelper, serviceContainer);
    }
    public discoverTestsImpl(ignoreCache: boolean): Promise<Tests> {
        const args = this.settings.unitTest.nosetestArgs.slice(0);
        const options: TestDiscoveryOptions = {
            workspaceFolder: this.workspaceFolder,
            cwd: this.rootDirectory, args,
            token: this.testDiscoveryCancellationToken, ignoreCache,
            outChannel: this.outputChannel
        };
        return discoverTests(this.serviceContainer, this.testsHelper, options);
    }
    // tslint:disable-next-line:no-any
    public runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<any> {
        const args = this.settings.unitTest.nosetestArgs.slice(0);
        if (runFailedTests === true && args.indexOf('--failed') === -1) {
            args.push('--failed');
        }
        if (!runFailedTests && args.indexOf('--with-id') === -1) {
            args.push('--with-id');
        }
        const options: TestRunOptions = {
            workspaceFolder: Uri.file(this.rootDirectory),
            cwd: this.rootDirectory,
            tests, args, testsToRun,
            token: this.testRunnerCancellationToken,
            outChannel: this.outputChannel,
            debug
        };
        return runTest(this.serviceContainer, this.testResultsService, this.debugLauncher, options);
    }
}
