import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { Product } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { NOSETEST_PROVIDER } from '../common/constants';
import { BaseTestManager } from '../common/managers/baseTestManager';
import { ITestsHelper, TestDiscoveryOptions, TestRunOptions, Tests, TestsToRun } from '../common/types';
import { IArgumentsService, ITestManagerRunner, TestFilter } from '../types';

@injectable()
export class TestManager extends BaseTestManager {
    private readonly argsService: IArgumentsService;
    private readonly helper: ITestsHelper;
    private readonly runner: ITestManagerRunner;
    public get enabled() {
        return this.settings.testing.nosetestsEnabled;
    }
    constructor(
        workspaceFolder: Uri,
        rootDirectory: string,
        @inject(IServiceContainer) serviceContainer: IServiceContainer
    ) {
        super(NOSETEST_PROVIDER, Product.nosetest, workspaceFolder, rootDirectory, serviceContainer);
        this.argsService = this.serviceContainer.get<IArgumentsService>(IArgumentsService, this.testProvider);
        this.helper = this.serviceContainer.get<ITestsHelper>(ITestsHelper);
        this.runner = this.serviceContainer.get<ITestManagerRunner>(ITestManagerRunner, this.testProvider);
    }
    public getDiscoveryOptions(ignoreCache: boolean): TestDiscoveryOptions {
        const args = this.settings.testing.nosetestArgs.slice(0);
        return {
            workspaceFolder: this.workspaceFolder,
            cwd: this.rootDirectory,
            args,
            token: this.testDiscoveryCancellationToken!,
            ignoreCache,
            outChannel: this.outputChannel,
        };
    }
    public runTestImpl(
        tests: Tests,
        testsToRun?: TestsToRun,
        runFailedTests?: boolean,
        debug?: boolean
    ): Promise<Tests> {
        let args: string[];

        const runAllTests = this.helper.shouldRunAllTests(testsToRun);
        if (debug) {
            args = this.argsService.filterArguments(
                this.settings.testing.nosetestArgs,
                runAllTests ? TestFilter.debugAll : TestFilter.debugSpecific
            );
        } else {
            args = this.argsService.filterArguments(
                this.settings.testing.nosetestArgs,
                runAllTests ? TestFilter.runAll : TestFilter.runSpecific
            );
        }

        if (runFailedTests === true && args.indexOf('--failed') === -1) {
            args.splice(0, 0, '--failed');
        }
        if (!runFailedTests && args.indexOf('--with-id') === -1) {
            args.splice(0, 0, '--with-id');
        }
        const options: TestRunOptions = {
            workspaceFolder: Uri.file(this.rootDirectory),
            cwd: this.rootDirectory,
            tests,
            args,
            testsToRun,
            token: this.testRunnerCancellationToken!,
            outChannel: this.outputChannel,
            debug,
        };
        return this.runner.runTest(this.testResultsService, options, this);
    }
}
