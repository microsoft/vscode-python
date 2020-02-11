'use strict';

import { Uri } from 'vscode';
import { Product } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { PYTEST_PROVIDER } from '../common/constants';
import { BaseTestManager } from '../common/managers/baseTestManager';
import {
    ITestMessageService,
    ITestsHelper,
    TestDiscoveryOptions,
    TestRunOptions,
    Tests,
    TestsToRun
} from '../common/types';
import { IArgumentsService, IPythonTestMessage, ITestManagerRunner, TestFilter } from '../types';

export class TestManager extends BaseTestManager {
    private readonly argsService: IArgumentsService;
    private readonly helper: ITestsHelper;
    private readonly runner: ITestManagerRunner;
    private readonly testMessageService: ITestMessageService;
    public get enabled() {
        return this.settings.testing.pytestEnabled;
    }
    constructor(workspaceFolder: Uri, rootDirectory: string, serviceContainer: IServiceContainer) {
        super(PYTEST_PROVIDER, Product.pytest, workspaceFolder, rootDirectory, serviceContainer);
        this.argsService = this.serviceContainer.get<IArgumentsService>(IArgumentsService, this.testProvider);
        this.helper = this.serviceContainer.get<ITestsHelper>(ITestsHelper);
        this.runner = this.serviceContainer.get<ITestManagerRunner>(ITestManagerRunner, this.testProvider);
        this.testMessageService = this.serviceContainer.get<ITestMessageService>(
            ITestMessageService,
            this.testProvider
        );
    }
    public getDiscoveryOptions(ignoreCache: boolean): TestDiscoveryOptions {
        const args = this.settings.testing.pytestArgs.slice(0);
        return {
            workspaceFolder: this.workspaceFolder,
            cwd: this.rootDirectory,
            args,
            token: this.testDiscoveryCancellationToken!,
            ignoreCache,
            outChannel: this.outputChannel
        };
    }
    public async runTestImpl(
        tests: Tests,
        testsToRun?: TestsToRun,
        runFailedTests?: boolean,
        debug?: boolean
    ): Promise<Tests> {
        let args: string[];

        const runAllTests = this.helper.shouldRunAllTests(testsToRun);
        if (debug) {
            args = this.argsService.filterArguments(
                this.settings.testing.pytestArgs,
                runAllTests ? TestFilter.debugAll : TestFilter.debugSpecific
            );
        } else {
            args = this.argsService.filterArguments(
                this.settings.testing.pytestArgs,
                runAllTests ? TestFilter.runAll : TestFilter.runSpecific
            );
        }

        if (runFailedTests === true && args.indexOf('--lf') === -1 && args.indexOf('--last-failed') === -1) {
            args.splice(0, 0, '--last-failed');
        }
        const options: TestRunOptions = {
            workspaceFolder: this.workspaceFolder,
            cwd: this.rootDirectory,
            tests,
            args,
            testsToRun,
            debug,
            token: this.testRunnerCancellationToken!,
            outChannel: this.outputChannel
        };
        const testResults = await this.runner.runTest(this.testResultsService, options, this);
        const messages: IPythonTestMessage[] = await this.testMessageService.getFilteredTestMessages(
            this.rootDirectory,
            testResults
        );
        await this.updateDiagnostics(tests, messages);
        return testResults;
    }
}
