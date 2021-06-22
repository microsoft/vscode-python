// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable, inject, named } from 'inversify';
import { test, TestItem, TestMessage, TestMessageSeverity, TestResultState, TestRun, TestRunRequest } from 'vscode';
import { traceError } from '../../../common/logger';
import * as internalScripts from '../../../common/process/internal/scripts';
import { IOutputChannel } from '../../../common/types';
import { UNITTEST_PROVIDER } from '../../common/constants';
import { ITestRunner, ITestDebugLauncher, IUnitTestSocketServer, LaunchOptions, Options } from '../../common/types';
import { TEST_OUTPUT_CHANNEL } from '../../constants';
import { processTestNode, TestRunInstanceOptions } from '../common/runHelper';
import { getTestCaseNodes } from '../common/testItemUtilities';
import { ITestsRunner, PythonRunnableTestData, PythonTestData, TestRunOptions } from '../common/types';
import { getTestRunArgs } from './arguments';

interface ITestData {
    test: string;
    message: string;
    outcome: string;
    traceback: string;
}

@injectable()
export class UnittestRunner implements ITestsRunner {
    constructor(
        @inject(ITestRunner) private readonly runner: ITestRunner,
        @inject(ITestDebugLauncher) private readonly debugLauncher: ITestDebugLauncher,
        @inject(IOutputChannel) @named(TEST_OUTPUT_CHANNEL) private readonly outputChannel: IOutputChannel,
        @inject(IUnitTestSocketServer) private readonly server: IUnitTestSocketServer,
    ) {}

    public async runTests(request: TestRunRequest<PythonTestData>, options: TestRunOptions): Promise<void> {
        const runOptions: TestRunInstanceOptions = {
            ...options,
            exclude: request.exclude,
            debug: request.debug,
        };
        const runInstance = test.createTestRun(request);
        try {
            await Promise.all(
                request.tests.map((testNode) =>
                    processTestNode(testNode, runInstance, runOptions, this.runTest.bind(this)),
                ),
            );
        } catch (ex) {
            runInstance.appendOutput(`Error while running tests:\r\n${ex}\r\n\r\n`);
        } finally {
            runInstance.appendOutput(`Finished running tests!\r\n`);
            runInstance.end();
        }
    }

    private async runTest(
        testNode: TestItem<PythonRunnableTestData>,
        runInstance: TestRun<PythonTestData>,
        options: TestRunInstanceOptions,
    ): Promise<void> {
        runInstance.appendOutput(`Running tests: ${testNode.label}\r\n`);
        const testCaseNodes = getTestCaseNodes(testNode);
        const tested: string[] = [];

        const counts = {
            total: testCaseNodes.length,
            passed: 0,
            skipped: 0,
            errored: 0,
            failed: 0,
        };

        let failFast = false;
        let stopTesting = false;
        this.server.on('error', (message: string, ...data: string[]) => {
            traceError(`${message} ${data.join(' ')}`);
        });
        this.server.on('log', (message: string, ...data: string[]) => {
            traceError(`${message} ${data.join(' ')}`);
        });
        this.server.on('connect', (message: string, ...data: string[]) => {
            traceError(`${message} ${data.join(' ')}`);
        });
        this.server.on('start', (message: string, ...data: string[]) => {
            traceError(`${message} ${data.join(' ')}`);
        });
        this.server.on('result', (data: ITestData) => {
            const testCase = testCaseNodes.find((node) => node.data.runId === data.test);
            if (testCase) {
                tested.push(testCase.data.runId);

                if (data.outcome === 'passed') {
                    const text = `${testCase.data.raw.id} Passed\r\n`;
                    runInstance.setState(testCase, TestResultState.Passed);
                    runInstance.appendOutput(text);
                    counts.passed += 1;
                } else if (data.outcome === 'failed') {
                    const text = `${testCase.data.raw.id} Failed: ${data.message}\r\n${data.traceback}\r\n`;
                    const message = new TestMessage(text);
                    message.severity = TestMessageSeverity.Information;

                    runInstance.setState(testCase, TestResultState.Failed);
                    runInstance.appendOutput(text);
                    runInstance.appendMessage(testCase, message);
                    counts.failed += 1;
                    if (failFast) {
                        stopTesting = true;
                    }
                } else if (data.outcome === 'error') {
                    const text = `${testCase.data.raw.id} Failed with Error: ${data.message}\r\n${data.traceback}\r\n`;
                    const message = new TestMessage(text);
                    message.severity = TestMessageSeverity.Error;

                    runInstance.setState(testCase, TestResultState.Errored);
                    runInstance.appendOutput(text);
                    runInstance.appendMessage(testCase, message);
                    counts.errored += 1;
                    if (failFast) {
                        stopTesting = true;
                    }
                } else if (data.outcome === 'skipped') {
                    const text = `${testCase.data.raw.id} Skipped: ${data.message}\r\n${data.traceback}\r\n`;
                    runInstance.setState(testCase, TestResultState.Skipped);
                    runInstance.appendOutput(text);
                    counts.skipped += 1;
                } else {
                    traceError(`Unknown outcome type for test ${testCase.data.raw.id}: ${data.outcome}`);
                }
            }
        });

        const port = await this.server.start();
        const runTestInternal = async (testFile = '', testId = ''): Promise<void> => {
            let testArgs = getTestRunArgs(options.args);
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
                testArgs.push('--debug');
                const launchOptions: LaunchOptions = {
                    cwd: options.cwd,
                    args: testArgs,
                    token: options.token,
                    outChannel: this.outputChannel,
                    testProvider: UNITTEST_PROVIDER,
                };
                return this.debugLauncher.launchDebugger(launchOptions);
            }
            const args = internalScripts.visualstudio_py_testlauncher(testArgs);

            const runOptions: Options = {
                args,
                cwd: options.cwd,
                outChannel: this.outputChannel,
                token: options.token,
                workspaceFolder: options.workspaceFolder,
            };
            await this.runner.run(UNITTEST_PROVIDER, runOptions);
            return Promise.resolve();
        };

        try {
            for (const testCaseNode of testCaseNodes) {
                if (stopTesting) {
                    break;
                }
                // VS Code API requires that we set the run state on the leaf nodes. The state of the
                // parent nodes are computed based on the state of child nodes.
                runInstance.setState(testCaseNode, TestResultState.Running);
                await runTestInternal(testCaseNode.uri?.fsPath, testCaseNode.data.runId);
            }
        } catch (ex) {
            traceError(ex);
        } finally {
            this.server.removeAllListeners();
        }

        runInstance.appendOutput(`Total number of tests passed: ${counts.passed}\r\n`);
        runInstance.appendOutput(`Total number of tests failed: ${counts.failed}\r\n`);
        runInstance.appendOutput(`Total number of tests failed with errors: ${counts.errored}\r\n`);
        runInstance.appendOutput(`Total number of tests skipped: ${counts.skipped}\r\n`);

        if (failFast) {
            runInstance.appendOutput(
                `Total number of tests skipped due to fail fast: ${counts.total - tested.length}\r\n`,
            );
        }
    }
}
