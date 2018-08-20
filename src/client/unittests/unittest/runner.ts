'use strict';

import { inject, injectable } from 'inversify';
import { Socket } from 'net';
import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../common/constants';
import { noop } from '../../common/core.utils';
import { ILogger } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { UNITTEST_PROVIDER } from '../common/constants';
import { Options } from '../common/runner';
import {
    ITestDebugLauncher, ITestManager, ITestResultsService,
    ITestRunner, IUnitTestSocketServer, LaunchOptions,
    TestRunOptions, Tests, TestStatus
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
    private readonly logger: ILogger;
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.argsHelper = serviceContainer.get<IArgumentsHelper>(IArgumentsHelper);
        this.testRunner = serviceContainer.get<ITestRunner>(ITestRunner);
        this.server = this.serviceContainer.get<IUnitTestSocketServer>(IUnitTestSocketServer);
        this.logger = this.serviceContainer.get<ILogger>(ILogger);
        this.helper = this.serviceContainer.get<IUnitTestHelper>(IUnitTestHelper);
    }

    // tslint:disable-next-line:max-func-body-length
    public async runTest(testResultsService: ITestResultsService, options: TestRunOptions, testManager: ITestManager): Promise<Tests> {
        options.tests.summary.errors = 0;
        options.tests.summary.failures = 0;
        options.tests.summary.passed = 0;
        options.tests.summary.skipped = 0;
        let failFast = false;
        const testLauncherFile = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'PythonTools', 'visualstudio_py_testlauncher.py');
        this.server.on('error', (message: string, ...data: string[]) => this.logger.logError(`${message} ${data.join(' ')}`));
        this.server.on('log', noop);
        this.server.on('connect', noop);
        this.server.on('start', noop);
        this.server.on('result', (data: ITestData) => {
            const test = options.tests.testFunctions.find(t => t.testFunction.nameToRun === data.test);
            const statusDetails = outcomeMapping.get(data.outcome)!;
            if (test) {
                test.testFunction.status = statusDetails.status;
                test.testFunction.message = data.message;
                test.testFunction.traceback = data.traceback;
                options.tests.summary[statusDetails.summaryProperty] += 1;

                if (failFast && (statusDetails.summaryProperty === 'failures' || statusDetails.summaryProperty === 'errors')) {
                    testManager.stop();
                }
            } else {
                if (statusDetails) {
                    options.tests.summary[statusDetails.summaryProperty] += 1;
                }
            }
        });

        this.server.on('socket.disconnected', (socket: Socket, isSocketDestroyed: boolean) => {
            this.server.removeAllListeners();
        });

        const port = await this.server.start();
        const testPaths: string[] = this.helper.getIdsOfTestsToRun(options.tests, options.testsToRun!);
        for (let counter = 0; counter < testPaths.length; counter += 1) {
            testPaths[counter] = `-t${testPaths[counter].trim()}`;
        }

        const runTestInternal = async (testFile: string = '', testId: string = '') => {
            let testArgs = this.buildTestArgs(options.args);
            failFast = testArgs.indexOf('--uf') >= 0;
            testArgs = testArgs.filter(arg => arg !== '--uf');

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
                const launchOptions: LaunchOptions = { cwd: options.cwd, args: testArgs, token: options.token, outChannel: options.outChannel, testProvider: UNITTEST_PROVIDER };
                return debugLauncher.launchDebugger(launchOptions);
            } else {
                const runOptions: Options = {
                    args: [testLauncherFile].concat(testArgs),
                    cwd: options.cwd,
                    outChannel: options.outChannel,
                    token: options.token,
                    workspaceFolder: options.workspaceFolder
                };
                await this.testRunner.run(UNITTEST_PROVIDER, runOptions);
            }
        };

        // Test everything.
        if (testPaths.length === 0) {
            await runTestInternal();
        }

        // Ok, the test runner can only work with one test at a time.
        if (options.testsToRun) {
            let promise = Promise.resolve<void>(undefined);
            if (Array.isArray(options.testsToRun.testFile)) {
                options.testsToRun.testFile.forEach(testFile => {
                    promise = promise.then(() => runTestInternal(testFile.fullPath, testFile.nameToRun));
                });
            }
            if (Array.isArray(options.testsToRun.testSuite)) {
                options.testsToRun.testSuite.forEach(testSuite => {
                    const testFileName = options.tests.testSuites.find(t => t.testSuite === testSuite)!.parentTestFile.fullPath;
                    promise = promise.then(() => runTestInternal(testFileName, testSuite.nameToRun));
                });
            }
            if (Array.isArray(options.testsToRun.testFunction)) {
                options.testsToRun.testFunction.forEach(testFn => {
                    const testFileName = options.tests.testFunctions.find(t => t.testFunction === testFn)!.parentTestFile.fullPath;
                    promise = promise.then(() => runTestInternal(testFileName, testFn.nameToRun));
                });
            }
            await promise;
        }

        testResultsService.updateResults(options.tests);
        return options.tests;
    }

    private buildTestArgs(args: string[]): string[] {
        const startTestDiscoveryDirectory = this.helper.getStartDirectory(args);
        let pattern = 'test*.py';
        const shortValue = this.argsHelper.getOptionValues(args, '-p');
        const longValueValue = this.argsHelper.getOptionValues(args, '-pattern');
        if (typeof shortValue === 'string') {
            pattern = shortValue;
        } else if (typeof longValueValue === 'string') {
            pattern = longValueValue;
        }
        const failFast = args.some(arg => arg.trim() === '-f' || arg.trim() === '--failfast');
        const verbosity = args.some(arg => arg.trim().indexOf('-v') === 0) ? 2 : 1;
        const testArgs = [`--us=${startTestDiscoveryDirectory}`, `--up=${pattern}`, `--uvInt=${verbosity}`];
        if (failFast) {
            testArgs.push('--uf');
        }
        return testArgs;
    }
}
