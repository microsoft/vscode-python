// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable, inject, named } from 'inversify';
import { Location, TestController, TestItem, TestMessage, TestRun, TestRunRequest } from 'vscode';
import { traceError, traceInfo } from '../../../common/logger';
import * as internalScripts from '../../../common/process/internal/scripts';
import { IOutputChannel } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { noop } from '../../../common/utils/misc';
import { UNITTEST_PROVIDER } from '../../common/constants';
import { ITestRunner, ITestDebugLauncher, IUnitTestSocketServer, LaunchOptions, Options } from '../../common/types';
import { TEST_OUTPUT_CHANNEL } from '../../constants';
import { getTestCaseNodes } from '../common/testItemUtilities';
import { ITestsRunner, TestData, TestRunInstanceOptions, TestRunOptions } from '../common/types';
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

    public async runTests(
        testController: TestController,
        request: TestRunRequest,
        debug: boolean,
        options: TestRunOptions,
        idToRawData: Map<string, TestData>,
    ): Promise<void> {
        const runOptions: TestRunInstanceOptions = {
            ...options,
            exclude: request.exclude,
            debug,
        };

        const runInstance = testController.createTestRun(request);
        const dispose = options.token.onCancellationRequested(() => {
            runInstance.end();
        });
        try {
            await Promise.all(
                (request.include ?? []).map((testNode) => this.runTest(testNode, runInstance, runOptions, idToRawData)),
            );
        } catch (ex) {
            runInstance.appendOutput(`Error while running tests:\r\n${ex}\r\n\r\n`);
        } finally {
            runInstance.appendOutput(`Finished running tests!\r\n`);
            runInstance.end();
            dispose.dispose();
        }
    }

    private async runTest(
        testNode: TestItem,
        runInstance: TestRun,
        options: TestRunInstanceOptions,
        idToRawData: Map<string, TestData>,
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
        let testCasePromise: Deferred<void>;
        this.server.on('error', (message: string, ...data: string[]) => {
            traceError(`${message} ${data.join(' ')}`);
            testCasePromise.reject();
        });
        this.server.on('log', (message: string, ...data: string[]) => {
            traceInfo(`${message} ${data.join(' ')}`);
        });
        this.server.on('connect', noop);
        this.server.on('start', noop);
        this.server.on('result', (data: ITestData) => {
            testCasePromise.resolve();
            const testCase = testCaseNodes.find((node) => idToRawData.get(node.id)?.runId === data.test);
            const rawTestCase = idToRawData.get(testCase?.id ?? '');
            if (testCase && rawTestCase) {
                tested.push(rawTestCase.runId);

                if (data.outcome === 'passed') {
                    const text = `${rawTestCase.rawId} Passed\r\n`;
                    runInstance.passed(testCase);
                    runInstance.appendOutput(text);
                    counts.passed += 1;
                } else if (data.outcome === 'failed') {
                    const traceback = data.traceback.splitLines({ trim: false, removeEmptyEntries: true }).join('\r\n');
                    const text = `${rawTestCase.rawId} Failed: ${data.message}\r\n${traceback}\r\n`;
                    const message = new TestMessage(text);

                    if (testCase.uri && testCase.range) {
                        message.location = new Location(testCase.uri, testCase.range);
                    }

                    runInstance.failed(testCase, message);
                    runInstance.appendOutput(text);
                    counts.failed += 1;
                    if (failFast) {
                        stopTesting = true;
                    }
                } else if (data.outcome === 'error') {
                    const traceback = data.traceback.splitLines({ trim: false, removeEmptyEntries: true }).join('\r\n');
                    const text = `${rawTestCase.rawId} Failed with Error: ${data.message}\r\n${traceback}\r\n`;
                    const message = new TestMessage(text);

                    if (testCase.uri && testCase.range) {
                        message.location = new Location(testCase.uri, testCase.range);
                    }

                    runInstance.errored(testCase, message);
                    runInstance.appendOutput(text);
                    counts.errored += 1;
                    if (failFast) {
                        stopTesting = true;
                    }
                } else if (data.outcome === 'skipped') {
                    const traceback = data.traceback.splitLines({ trim: false, removeEmptyEntries: true }).join('\r\n');
                    const text = `${rawTestCase.rawId} Skipped: ${data.message}\r\n${traceback}\r\n`;
                    runInstance.skipped(testCase);
                    runInstance.appendOutput(text);
                    counts.skipped += 1;
                } else {
                    const text = `Unknown outcome type for test ${rawTestCase.rawId}: ${data.outcome}`;
                    runInstance.appendOutput(text);
                    const message = new TestMessage(text);
                    if (testCase.uri && testCase.range) {
                        message.location = new Location(testCase.uri, testCase.range);
                    }
                    runInstance.errored(testCase, message);
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
            testCasePromise = createDeferred();
            await this.runner.run(UNITTEST_PROVIDER, runOptions);
            return testCasePromise.promise;
        };

        try {
            for (const testCaseNode of testCaseNodes) {
                if (stopTesting || options.token.isCancellationRequested) {
                    break;
                }

                const rawTestCaseNode = idToRawData.get(testCaseNode.id);
                if (rawTestCaseNode) {
                    // VS Code API requires that we set the run state on the leaf nodes. The state of the
                    // parent nodes are computed based on the state of child nodes.
                    runInstance.started(testCaseNode);
                    await runTestInternal(testCaseNode.uri?.fsPath, rawTestCaseNode.runId);
                }
            }
        } catch (ex) {
            traceError(ex);
        } finally {
            this.server.removeAllListeners();
            this.server.stop();
        }

        runInstance.appendOutput(`Total number of tests expected to run: ${testCaseNodes.length}\r\n`);
        runInstance.appendOutput(`Total number of tests run: ${counts.total}\r\n`);
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
