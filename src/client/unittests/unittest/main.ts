import { Uri } from 'vscode';
import { PythonSettings } from '../../common/configSettings';
import { Product } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { BaseTestManager } from '../common/managers/baseTestManager';
import { TestDiscoveryOptions, TestRunOptions, Tests, TestStatus, TestsToRun } from '../common/types';
import { runTest } from './runner';

export class TestManager extends BaseTestManager {
    public get enabled() {
        return PythonSettings.getInstance(this.workspaceFolder).unitTest.unittestEnabled;
    }
    constructor(workspaceFolder: Uri, rootDirectory: string, serviceContainer: IServiceContainer) {
        super('unittest', Product.unittest, workspaceFolder, rootDirectory, serviceContainer);
    }
    // tslint:disable-next-line:no-empty
    public configure() {
    }
    public getDiscoveryOptions(ignoreCache: boolean): TestDiscoveryOptions {
        const args = this.settings.unitTest.unittestArgs.slice(0);
        return {
            workspaceFolder: this.workspaceFolder,
            cwd: this.rootDirectory, args,
            token: this.testDiscoveryCancellationToken!, ignoreCache,
            outChannel: this.outputChannel
        };
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
            token: this.testRunnerCancellationToken!,
            outChannel: this.outputChannel
        };
        return runTest(this.serviceContainer, this, this.testResultsService, options);
    }
}
