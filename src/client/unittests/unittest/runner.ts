'use strict';
import * as path from 'path';
import { IServiceContainer } from '../../ioc/types';
import { BaseTestManager } from '../common/managers/baseTestManager';
import { Options, run } from '../common/runner';
import { ITestDebugLauncher, ITestResultsService, IUnitTestSocketServer, LaunchOptions, TestRunOptions, Tests, TestStatus, TestsToRun } from '../common/types';

type TestStatusMap = {
    status: TestStatus;
    summaryProperty: 'passed' | 'failures' | 'errors' | 'skipped';
};

const outcomeMapping = new Map<string, TestStatusMap>();
// tslint:disable-next-line:no-backbone-get-set-outside-model
outcomeMapping.set('passed', { status: TestStatus.Pass, summaryProperty: 'passed' });
// tslint:disable-next-line:no-backbone-get-set-outside-model
outcomeMapping.set('failed', { status: TestStatus.Fail, summaryProperty: 'failures' });
// tslint:disable-next-line:no-backbone-get-set-outside-model
outcomeMapping.set('error', { status: TestStatus.Error, summaryProperty: 'errors' });
// tslint:disable-next-line:no-backbone-get-set-outside-model
outcomeMapping.set('skipped', { status: TestStatus.Skipped, summaryProperty: 'skipped' });

interface ITestData {
    test: string;
    message: string;
    outcome: string;
    traceback: string;
}

// tslint:disable-next-line:max-func-body-length
export async function runTest(serviceContainer: IServiceContainer, testManager: BaseTestManager, testResultsService: ITestResultsService, options: TestRunOptions): Promise<Tests> {
    options.tests.summary.errors = 0;
    options.tests.summary.failures = 0;
    options.tests.summary.passed = 0;
    options.tests.summary.skipped = 0;
    let failFast = false;
    const testLauncherFile = path.join(__dirname, '..', '..', '..', '..', 'pythonFiles', 'PythonTools', 'visualstudio_py_testlauncher.py');
    const server = serviceContainer.get<IUnitTestSocketServer>(IUnitTestSocketServer);
    server.on('error', (message: string, ...data: string[]) => {
        // tslint:disable-next-line:no-console
        console.log(`${message} ${data.join(' ')}`);
    });
    // tslint:disable-next-line:no-empty
    server.on('log', (message: string, ...data: string[]) => {
    });
    // tslint:disable-next-line:no-empty no-any
    server.on('connect', (data: any) => {
    });
    // tslint:disable-next-line:no-empty
    server.on('start', (data: { test: string }) => {
    });
    server.on('result', (data: ITestData) => {
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
    // tslint:disable-next-line:no-empty no-any
    server.on('socket.disconnected', (data: any) => {
    });

    return server.start().then(port => {
        const testPaths: string[] = getIdsOfTestsToRun(options.tests, options.testsToRun!);
        for (let counter = 0; counter < testPaths.length; counter += 1) {
            testPaths[counter] = `-t${testPaths[counter].trim()}`;
        }
        const startTestDiscoveryDirectory = getStartDirectory(options.args);

        function runTestInternal(testFile: string = '', testId: string = '') {
            let testArgs = buildTestArgs(options.args);
            failFast = testArgs.indexOf('--uf') >= 0;
            testArgs = testArgs.filter(arg => arg !== '--uf');

            testArgs.push(`--result-port=${port}`);
            testArgs.push(`--us=${startTestDiscoveryDirectory}`);
            if (testId.length > 0) {
                testArgs.push(`-t${testId}`);
            }
            if (testFile.length > 0) {
                testArgs.push(`--testFile=${testFile}`);
            }
            if (options.debug === true) {
                const debugLauncher = serviceContainer.get<ITestDebugLauncher>(ITestDebugLauncher);
                testArgs.push(...['--debug']);
                const launchOptions: LaunchOptions = { cwd: options.cwd, args: testArgs, token: options.token, outChannel: options.outChannel, testProvider: 'unittest' };
                // tslint:disable-next-line:prefer-type-cast no-any
                return debugLauncher.launchDebugger(launchOptions);
            } else {
                // tslint:disable-next-line:prefer-type-cast no-any
                const runOptions: Options = {
                    args: [testLauncherFile].concat(testArgs),
                    cwd: options.cwd,
                    outChannel: options.outChannel,
                    token: options.token,
                    workspaceFolder: options.workspaceFolder
                };
                return run(serviceContainer, 'unittest', runOptions);
            }
        }

        // Test everything
        if (testPaths.length === 0) {
            return runTestInternal();
        }

        // Ok, the ptvs test runner can only work with one test at a time
        let promise = Promise.resolve<string>('');
        if (Array.isArray(options.testsToRun!.testFile)) {
            options.testsToRun!.testFile!.forEach(testFile => {
                // tslint:disable-next-line:prefer-type-cast no-any
                promise = promise.then(() => runTestInternal(testFile.fullPath, testFile.nameToRun) as Promise<any>);
            });
        }
        if (Array.isArray(options.testsToRun!.testSuite)) {
            options.testsToRun!.testSuite!.forEach(testSuite => {
                const testFileName = options.tests.testSuites.find(t => t.testSuite === testSuite)!.parentTestFile.fullPath;
                // tslint:disable-next-line:prefer-type-cast no-any
                promise = promise.then(() => runTestInternal(testFileName, testSuite.nameToRun) as Promise<any>);
            });
        }
        if (Array.isArray(options.testsToRun!.testFunction)) {
            options.testsToRun!.testFunction!.forEach(testFn => {
                const testFileName = options.tests.testFunctions.find(t => t.testFunction === testFn)!.parentTestFile.fullPath;
                // tslint:disable-next-line:prefer-type-cast no-any
                promise = promise.then(() => runTestInternal(testFileName, testFn.nameToRun) as Promise<any>);
            });
        }
        // tslint:disable-next-line:prefer-type-cast no-any
        return promise as Promise<any>;
    }).then(() => {
        testResultsService.updateResults(options.tests);
        return options.tests;
    }).catch(reason => {
        return Promise.reject(reason);
    });
}
function getStartDirectory(args: string[]): string {
    let startDirectory = '.';
    const indexOfStartDir = args.findIndex(arg => arg.indexOf('-s') === 0 || arg.indexOf('--start-directory') === 0);
    if (indexOfStartDir >= 0) {
        const startDir = args[indexOfStartDir].trim();
        if ((startDir.trim() === '-s' || startDir.trim() === '--start-directory') && args.length >= indexOfStartDir) {
            // Assume the next items is the directory
            startDirectory = args[indexOfStartDir + 1];
        } else {
            const lenToStartFrom = startDir.startsWith('-s') ? '-s'.length : '--start-directory'.length;
            startDirectory = startDir.substring(lenToStartFrom).trim();
            if (startDirectory.startsWith('=')) {
                startDirectory = startDirectory.substring(1);
            }
        }
    }
    return startDirectory;
}
function buildTestArgs(args: string[]): string[] {
    const startTestDiscoveryDirectory = getStartDirectory(args);
    let pattern = 'test*.py';
    const indexOfPattern = args.findIndex(arg => arg.indexOf('-p') === 0 || arg.indexOf('--pattern') === 0);
    if (indexOfPattern >= 0) {
        const patternValue = args[indexOfPattern].trim();
        if ((patternValue.trim() === '-p' || patternValue.trim() === '--pattern') && args.length >= indexOfPattern) {
            // Assume the next items is the directory
            pattern = args[indexOfPattern + 1];
        } else {
            const lenToStartFrom = patternValue.startsWith('-p') ? '-p'.length : '--pattern'.length;
            pattern = patternValue.substring(lenToStartFrom).trim();
            if (pattern.startsWith('=')) {
                pattern = pattern.substring(1);
            }
        }
    }
    const failFast = args.some(arg => arg.trim() === '-f' || arg.trim() === '--failfast');
    const verbosity = args.some(arg => arg.trim().indexOf('-v') === 0) ? 2 : 1;
    const testArgs = [`--us=${startTestDiscoveryDirectory}`, `--up=${pattern}`, `--uvInt=${verbosity}`];
    if (failFast) {
        testArgs.push('--uf');
    }
    return testArgs;
}
function getIdsOfTestsToRun(tests: Tests, testsToRun: TestsToRun): string[] {
    const testIds: string[] = [];
    if (testsToRun && testsToRun.testFolder) {
        // Get test ids of files in these folders
        testsToRun.testFolder.map(folder => {
            tests.testFiles.forEach(f => {
                if (f.fullPath.startsWith(folder.name)) {
                    testIds.push(f.nameToRun);
                }
            });
        });
    }
    if (testsToRun && testsToRun.testFile) {
        testIds.push(...testsToRun.testFile.map(f => f.nameToRun));
    }
    if (testsToRun && testsToRun.testSuite) {
        testIds.push(...testsToRun.testSuite.map(f => f.nameToRun));
    }
    if (testsToRun && testsToRun.testFunction) {
        testIds.push(...testsToRun.testFunction.map(f => f.nameToRun));
    }
    return testIds;
}
