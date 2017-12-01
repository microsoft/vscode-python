'use strict';
import { Uri } from 'vscode';
import { Product } from '../../common/installer';
import { IServiceContainer } from '../../ioc/types';
import { BaseTestManager } from '../common/managers/baseTestManager';
import { TestDiscoveryOptions, TestRunOptions, Tests, TestsToRun } from '../common/types';
import { runTest } from './runner';

export class TestManager extends BaseTestManager {
    constructor(workspaceFolder: Uri, rootDirectory: string,
        serviceContainer: IServiceContainer) {
        super('pytest', Product.pytest, workspaceFolder, rootDirectory, serviceContainer);
    }
    public getDiscoveryOptions(ignoreCache: boolean): TestDiscoveryOptions {
        const args = this.settings.unitTest.pyTestArgs.slice(0);
        return {
            workspaceFolder: this.workspaceFolder,
            cwd: this.rootDirectory, args,
            token: this.testDiscoveryCancellationToken!, ignoreCache,
            outChannel: this.outputChannel
        };
    }
    public async runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<{}> {
        const args = this.settings.unitTest.pyTestArgs.slice(0);
        if (runFailedTests === true && args.indexOf('--lf') === -1 && args.indexOf('--last-failed') === -1) {
            args.push('--last-failed');
        }
        const options: TestRunOptions = {
            workspaceFolder: this.workspaceFolder,
            cwd: this.rootDirectory,
            tests, args, testsToRun, debug,
            token: this.testRunnerCancellationToken!,
            outChannel: this.outputChannel
        };
        return runTest(this.serviceContainer, this.testResultsService, options);
    }
}
