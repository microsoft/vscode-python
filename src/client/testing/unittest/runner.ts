'use strict';

import { inject, injectable } from 'inversify';
import { traceError } from '../../common/logger';
import * as internalScripts from '../../common/process/internal/scripts';
import { IDisposableRegistry } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { noop } from '../../common/utils/misc';
import { IServiceContainer } from '../../ioc/types';
import { UNITTEST_PROVIDER } from '../common/constants';
import { Options } from '../common/runner';
import {
    ITestDebugLauncher,
    ITestManager,
    ITestResultsService,
    ITestRunner,
    IUnitTestSocketServer,
    LaunchOptions,
    TestRunOptions,
    Tests,
    TestStatus,
} from '../common/types';
import { IArgumentsHelper, ITestManagerRunner, IUnitTestHelper } from '../types';

type TestStatusMap = {
    status: TestStatus;
    summaryProperty: 'passed' | 'failures' | 'errors' | 'skipped';
};

const outcomeMapping = new Map<string, TestStatusMap>();
outcomeMapping.set('passed', { status: TestStatus.Pass, summaryProperty: 'passed' });
outcomeMapping.set('failed', { status: TestStatus.Fail, summaryProperty: 'failures' });
outcomeMapping.set('error', { status: TestStatus.Error, summaryProperty: 'errors' });
outcomeMapping.set('skipped', { status: TestStatus.Skipped, summaryProperty: 'skipped' });

interface ITestData {
    test: string;
    message: string;
    outcome: string;
    traceback: string;
}

@injectable()
export class TestManagerRunner implements ITestManagerRunner {
    private readonly argsHelper: IArgumentsHelper;
    private readonly helper: IUnitTestHelper;
    private readonly testRunner: ITestRunner;
    private readonly server: IUnitTestSocketServer;
    private busy!: Deferred<Tests>;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.argsHelper = serviceContainer.get<IArgumentsHelper>(IArgumentsHelper);
        this.testRunner = serviceContainer.get<ITestRunner>(ITestRunner);
        this.server = this.serviceContainer.get<IUnitTestSocketServer>(IUnitTestSocketServer);
        this.helper = this.serviceContainer.get<IUnitTestHelper>(IUnitTestHelper);
        this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry).push(this.server);
    }

    // tslint:disable-next-line:max-func-body-length
    public async runTest(
        testResultsService: ITestResultsService,
        options: TestRunOptions,
        testManager: ITestManager,
    ): Promise<Tests> {
        if (this.busy && !this.busy.completed) {
            return this.busy.promise;
        }
        this.busy = createDeferred<Tests>();

        options.tests.summary.errors = 0;
        options.tests.summary.failures = 0;
        options.tests.summary.passed = 0;
        options.tests.summary.skipped = 0;
        let failFast = false;
        this.server.on('error', (message: string, ...data: string[]) => traceError(`${message} ${data.join(' ')}`));
        this.server.on('log', noop);
        this.server.on('connect', noop);
        this.server.on('start', noop);
        this.server.on('result', (data: ITestData) => {
            const test = options.tests.testFunctions.find((t) => t.testFunction.nameToRun === data.test);
            const statusDetails = outcomeMapping.get(data.outcome)!;
            if (test) {
                test.testFunction.status = statusDetails.status;
                switch (test.testFunction.status) {
                    case TestStatus.Error:
                    case TestStatus.Fail: {
                        test.testFunction.passed = false;
                        break;
                    }
                    case TestStatus.Pass: {
                        test.testFunction.passed = true;
                        break;
                    }
                    default: {
                        test.testFunction.passed = undefined;
                    }
                }
                test.testFunction.message = data.message;
                test.testFunction.traceback = data.traceback;
                options.tests.summary[statusDetails.summaryProperty] += 1;

                if (
                    failFast &&
                    (statusDetails.summaryProperty === 'failures' || statusDetails.summaryProperty === 'errors')
                ) {
                    testManager.stop();
                }
            } else {
                if (statusDetails) {
                    options.tests.summary[statusDetails.summaryProperty] += 1;
                }
            }
        });

        const port = await this.server.start();
        const testPaths: string[] = this.helper.getIdsOfTestsToRun(options.tests, options.testsToRun!);
        for (let counter = 0; counter < testPaths.length; counter += 1) {
            testPaths[counter] = `-t${testPaths[counter].trim()}`;
        }

        const runTestInternal = async (testFile: string = '', testId: string = '') => {
            let testArgs = this.buildTestArgs(options.args);
            failFast = testArgs.indexOf('--uf') >= 0;
            testArgs = testArgs.filter((arg) => arg !== '--uf');

            testArgs.push(`--result-port=${port}`);
            if (testId.length > 0) {
                testArgs.push(`-t${testId}`);
            }
            if (testFile.length > 0) {
                testArgs.push(`--testFile=${testFile}`);
            }
            if (options.debug === true) {
                const debugLauncher = this.serviceContainer.get<ITestDebugLauncher>(ITestDebugLauncher);
                testArgs.push('--debug');
                const launchOptions: LaunchOptions = {
                    cwd: options.cwd,
                    args: testArgs,
                    token: options.token,
                    outChannel: options.outChannel,
                    testProvider: UNITTEST_PROVIDER,
                };
                return debugLauncher.launchDebugger(launchOptions);
            } else {
                const args = internalScripts.visualstudio_py_testlauncher(testArgs);

                const runOptions: Options = {
                    args: args,
                    cwd: options.cwd,
                    outChannel: options.outChannel,
                    token: options.token,
                    workspaceFolder: options.workspaceFolder,
                };
                await this.testRunner.run(UNITTEST_PROVIDER, runOptions);
            }
        };

        // Test everything.
        if (testPaths.length === 0) {
            await this.removeListenersAfter(runTestInternal());
        } else {
            // Ok, the test runner can only work with one test at a time.
            if (options.testsToRun) {
                if (Array.isArray(options.testsToRun.testFile)) {
                    for (const testFile of options.testsToRun.testFile) {
                        await runTestInternal(testFile.fullPath, testFile.nameToRun);
                    }
                }
                if (Array.isArray(options.testsToRun.testSuite)) {
                    for (const testSuite of options.testsToRun.testSuite) {
                        const item = options.tests.testSuites.find((t) => t.testSuite === testSuite);
                        if (item) {
                            const testFileName = item.parentTestFile.fullPath;
                            await runTestInternal(testFileName, testSuite.nameToRun);
                        }
                    }
                }
                if (Array.isArray(options.testsToRun.testFunction)) {
                    for (const testFn of options.testsToRun.testFunction) {
                        const item = options.tests.testFunctions.find((t) => t.testFunction === testFn);
                        if (item) {
                            const testFileName = item.parentTestFile.fullPath;
                            await runTestInternal(testFileName, testFn.nameToRun);
                        }
                    }
                }

                await this.removeListenersAfter(Promise.resolve());
            }
        }

        testResultsService.updateResults(options.tests);
        this.busy.resolve(options.tests);
        return options.tests;
    }

    // remove all the listeners from the server after all tests are complete,
    // and just pass the promise `after` through as we do not want to get in
    // the way here.
    // tslint:disable-next-line:no-any
    private async removeListenersAfter(after: Promise<any>): Promise<any> {
        return after
            .then(() => this.server.removeAllListeners())
            .catch((err) => {
                this.server.removeAllListeners();
                throw err; // keep propagating this downward
            });
    }

    private buildTestArgs(args: string[]): string[] {
        const startTestDiscoveryDirectory = this.helper.getStartDirectory(args);
        let pattern = 'test*.py';
        const shortValue = this.argsHelper.getOptionValues(args, '-p');
        const longValueValue = this.argsHelper.getOptionValues(args, '--pattern');
        if (typeof shortValue === 'string') {
            pattern = shortValue;
        } else if (typeof longValueValue === 'string') {
            pattern = longValueValue;
        }
        const failFast = args.some((arg) => arg.trim() === '-f' || arg.trim() === '--failfast');
        const verbosity = args.some((arg) => arg.trim().indexOf('-v') === 0) ? 2 : 1;
        const testArgs = [`--us=${startTestDiscoveryDirectory}`, `--up=${pattern}`, `--uvInt=${verbosity}`];
        if (failFast) {
            testArgs.push('--uf');
        }
        return testArgs;
    }
}
