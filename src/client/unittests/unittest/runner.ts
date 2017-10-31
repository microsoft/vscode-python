'use strict';
import * as path from 'path';
import { CancellationToken, OutputChannel, Uri } from 'vscode';
import { PythonSettings } from '../../common/configSettings';
import { BaseTestManager } from '../common/baseTestManager';
import { run } from '../common/runner';
import { ITestDebugLauncher, ITestResultsService, Tests, TestStatus, TestsToRun } from '../common/types';
import { Server } from './socketServer';
type TestStatusMap = {
    status: TestStatus;
    summaryProperty: string;
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
export function runTest(testManager: BaseTestManager, testResultsService: ITestResultsService, debugLauncher: ITestDebugLauncher, rootDirectory: string, tests: Tests, args: string[], testsToRun?: TestsToRun, token?: CancellationToken, outChannel?: OutputChannel, debug?: boolean): Promise<Tests> {
    tests.summary.errors = 0;
    tests.summary.failures = 0;
    tests.summary.passed = 0;
    tests.summary.skipped = 0;
    let failFast = false;
    const testLauncherFile = path.join(__dirname, '..', '..', '..', '..', 'pythonFiles', 'PythonTools', 'visualstudio_py_testlauncher.py');
    const server = new Server();
    server.on('error', (message: string, ...data: string[]) => {
        // tslint:disable-next-line:no-console
        console.log(`${message} ${data.join(' ')}`);
    });
    // tslint:disable-next-line:no-empty
    server.on('log', (message: string, ...data: string[]) => {
    });
    // tslint:disable-next-line:no-empty
    server.on('connect', (data) => {
    });
    // tslint:disable-next-line:no-empty
    server.on('start', (data: { test: string }) => {
    });
    server.on('result', (data: ITestData) => {
        const test = tests.testFunctions.find(t => t.testFunction.nameToRun === data.test);
        const statusDetails = outcomeMapping.get(data.outcome);
        if (test) {
            test.testFunction.status = statusDetails.status;
            test.testFunction.message = data.message;
            test.testFunction.traceback = data.traceback;
            tests.summary[statusDetails.summaryProperty] += 1;

            if (failFast && (statusDetails.summaryProperty === 'failures' || statusDetails.summaryProperty === 'errors')) {
                testManager.stop();
            }
        } else {
            if (statusDetails) {
                tests.summary[statusDetails.summaryProperty] += 1;
            }
        }
    });
    // tslint:disable-next-line:no-empty
    server.on('socket.disconnected', (data) => {
    });

    return server.start().then(port => {
        const testPaths: string[] = getIdsOfTestsToRun(tests, testsToRun);
        for (let counter = 0; counter < testPaths.length; counter += 1) {
            testPaths[counter] = `-t${testPaths[counter].trim()}`;
        }
        const startTestDiscoveryDirectory = getStartDirectory(args);

        function runTestInternal(testFile: string = '', testId: string = '') {
            let testArgs = buildTestArgs(args);
            failFast = testArgs.indexOf('--uf') >= 0;
            testArgs = testArgs.filter(arg => arg !== '--uf');

            testArgs.push(`--result-port=${port}`);
            if (debug === true) {
                const debugPort = PythonSettings.getInstance(Uri.file(rootDirectory)).unitTest.debugPort;
                testArgs.push(...['--secret=my_secret', `--port=${debugPort}`]);
            }
            testArgs.push(`--us=${startTestDiscoveryDirectory}`);
            if (testId.length > 0) {
                testArgs.push(`-t${testId}`);
            }
            if (testFile.length > 0) {
                testArgs.push(`--testFile=${testFile}`);
            }
            if (debug === true) {
                // tslint:disable-next-line:prefer-type-cast no-any
                return debugLauncher.launchDebugger(rootDirectory, [testLauncherFile].concat(testArgs), token, outChannel);
            } else {
                // tslint:disable-next-line:prefer-type-cast no-any
                return run(PythonSettings.getInstance(Uri.file(rootDirectory)).pythonPath, [testLauncherFile].concat(testArgs), rootDirectory, token, outChannel);
            }
        }

        // Test everything
        if (testPaths.length === 0) {
            return runTestInternal();
        }

        // Ok, the ptvs test runner can only work with one test at a time
        let promise = Promise.resolve<string>('');
        if (Array.isArray(testsToRun.testFile)) {
            testsToRun.testFile.forEach(testFile => {
                // tslint:disable-next-line:prefer-type-cast no-any
                promise = promise.then(() => runTestInternal(testFile.fullPath, testFile.nameToRun) as Promise<any>);
            });
        }
        if (Array.isArray(testsToRun.testSuite)) {
            testsToRun.testSuite.forEach(testSuite => {
                const testFileName = tests.testSuites.find(t => t.testSuite === testSuite).parentTestFile.fullPath;
                // tslint:disable-next-line:prefer-type-cast no-any
                promise = promise.then(() => runTestInternal(testFileName, testSuite.nameToRun) as Promise<any>);
            });
        }
        if (Array.isArray(testsToRun.testFunction)) {
            testsToRun.testFunction.forEach(testFn => {
                const testFileName = tests.testFunctions.find(t => t.testFunction === testFn).parentTestFile.fullPath;
                // tslint:disable-next-line:prefer-type-cast no-any
                promise = promise.then(() => runTestInternal(testFileName, testFn.nameToRun) as Promise<any>);
            });
        }
        // tslint:disable-next-line:prefer-type-cast no-any
        return promise as Promise<any>;
    }).then(() => {
        testResultsService.updateResults(tests);
        return tests;
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
    const testIds = [];
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
