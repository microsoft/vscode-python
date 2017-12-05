import { inject, injectable } from 'inversify';
import 'reflect-metadata';
import { Uri } from 'vscode';
import { Product } from '../../common/installer';
import { IServiceContainer } from '../../ioc/types';
import { BaseTestManager } from '../common/managers/baseTestManager';
import { TestDiscoveryOptions, TestRunOptions, Tests, TestsToRun } from '../common/types';
import { runTest } from './runner';

@injectable()
export class TestManager extends BaseTestManager {
    constructor(workspaceFolder: Uri, rootDirectory: string,
        @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('nosetest', Product.nosetest, workspaceFolder, rootDirectory, serviceContainer);
    }
    public getDiscoveryOptions(ignoreCache: boolean): TestDiscoveryOptions {
        const args = this.settings.unitTest.nosetestArgs.slice(0);
        return {
            workspaceFolder: this.workspaceFolder,
            cwd: this.rootDirectory, args,
            token: this.testDiscoveryCancellationToken!, ignoreCache,
            outChannel: this.outputChannel
        };
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
            token: this.testRunnerCancellationToken!,
            outChannel: this.outputChannel,
            debug
        };
        return runTest(this.serviceContainer, this.testResultsService, options);
    }
}
