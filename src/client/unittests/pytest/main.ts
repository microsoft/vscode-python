'use strict';

import { Uri } from 'vscode';
import { Product } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { PYTEST_PROVIDER } from '../common/constants';
import { BaseTestManager } from '../common/managers/baseTestManager';
import { ITestsHelper, TestDiscoveryOptions, TestRunOptions, Tests, TestsToRun } from '../common/types';
import { IArgumentsService, ITestManagerRunner, TestFilter } from '../types';

export class TestManager extends BaseTestManager {
    private readonly argsService: IArgumentsService;
    private readonly helper: ITestsHelper;
    private readonly runner: ITestManagerRunner;
    public get enabled() {
        return this.settings.unitTest.pyTestEnabled;
    }
    constructor(workspaceFolder: Uri, rootDirectory: string,
        serviceContainer: IServiceContainer) {
        super(PYTEST_PROVIDER, Product.pytest, workspaceFolder, rootDirectory, serviceContainer);
        this.argsService = this.serviceContainer.get<IArgumentsService>(IArgumentsService, this.testProvider);
        this.helper = this.serviceContainer.get<ITestsHelper>(ITestsHelper);
        this.runner = this.serviceContainer.get<ITestManagerRunner>(ITestManagerRunner, this.testProvider);
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
    public async runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<Tests> {
        let args: string[];

        const runAllTests = this.helper.shouldRunAllTests(testsToRun);
        if (debug) {
            args = this.argsService.filterArguments(this.settings.unitTest.pyTestArgs, runAllTests ? TestFilter.debugAll : TestFilter.debugSpecific);
        } else {
            args = this.argsService.filterArguments(this.settings.unitTest.pyTestArgs, runAllTests ? TestFilter.runAll : TestFilter.runSpecific);
        }

        if (runFailedTests === true && args.indexOf('--lf') === -1 && args.indexOf('--last-failed') === -1) {
            args.splice(0, 0, '--last-failed');
        }
        const options: TestRunOptions = {
            workspaceFolder: this.workspaceFolder,
            cwd: this.rootDirectory,
            tests, args, testsToRun, debug,
            token: this.testRunnerCancellationToken!,
            outChannel: this.outputChannel
        };
        return this.runner.runTest(this.testResultsService, options, this);
    }
}
