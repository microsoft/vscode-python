// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable, inject, named } from 'inversify';
import { Location, TestController, TestItem, TestMessage, TestRun, TestRunProfileKind } from 'vscode';
import * as internalScripts from '../../../common/process/internal/scripts';
import { IOutputChannel } from '../../../common/types';
import { noop } from '../../../common/utils/misc';
import { traceError, traceInfo } from '../../../logging';
import { UNITTEST_PROVIDER } from '../../common/constants';
import { ITestRunner, ITestDebugLauncher, IUnitTestSocketServer, LaunchOptions, Options } from '../../common/types';
import { TEST_OUTPUT_CHANNEL } from '../../constants';
import { clearAllChildren, getTestCaseNodes } from '../common/testItemUtilities';
import { ITestRun, ITestsRunner, TestData, TestRunInstanceOptions, TestRunOptions } from '../common/types';
import { fixLogLines } from '../common/utils';
import { getTestRunArgs } from './arguments';

interface ITestData {
    test: string;
    message: string;
    outcome: string;
    traceback: string;
    subtest?: string;
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
        testRun: ITestRun,
        options: TestRunOptions,
        idToRawData: Map<string, TestData>,
        testController?: TestController,
    ): Promise<void> {
        const runOptions: TestRunInstanceOptions = {
            ...options,
            exclude: testRun.excludes,
            debug: testRun.runKind === TestRunProfileKind.Debug,
        };

        try {
            await this.runTest(testRun.includes, testRun.runInstance, runOptions, idToRawData, testController);
        } catch (ex) {
            testRun.runInstance.appendOutput(`Error while running tests:\r\n${ex}\r\n\r\n`);
        }
    }

    private async runTest(
        testNodes: TestItem[],
        runInstance: TestRun,
        options: TestRunInstanceOptions,
        idToRawData: Map<string, TestData>,
        testController?: TestController,
    ): Promise<void> {
        runInstance.appendOutput(`Running tests (unittest): ${testNodes.map((t) => t.id).join(' ; ')}\r\n`);
        const testCaseNodes: TestItem[] = [];
        const fileToTestCases: Map<string, TestItem[]> = new Map();

        testNodes.forEach((t) => {
            const nodes = getTestCaseNodes(t);
            nodes.forEach((n) => {
                if (n.uri) {
                    const fsRunIds = fileToTestCases.get(n.uri.fsPath);
                    if (fsRunIds) {
                        fsRunIds.push(n);
                    } else {
                        fileToTestCases.set(n.uri.fsPath, [n]);
                    }
                }
            });
            testCaseNodes.push(...nodes);
        });

        const tested: string[] = [];

        const counts = {
            total: 0,
            passed: 0,
            skipped: 0,
            errored: 0,
            failed: 0,
        };
        const subTestStats: Map<string, { passed: number; failed: number }> = new Map();

        let failFast = false;
        let stopTesting = false;
        this.server.on('error', (message: string, ...data: string[]) => {
            traceError(`${message} ${data.join(' ')}`);
        });
        this.server.on('log', (message: string, ...data: string[]) => {
            traceInfo(`${message} ${data.join(' ')}`);
        });
        this.server.on('connect', noop);
        this.server.on('start', noop);
        this.server.on('result', (data: ITestData) => {
            const testCase = testCaseNodes.find((node) => idToRawData.get(node.id)?.runId === data.test);
            const rawTestCase = idToRawData.get(testCase?.id ?? '');
            if (testCase && rawTestCase) {
                counts.total += 1;
                tested.push(rawTestCase.runId);

                if (data.outcome === 'passed' || data.outcome === 'failed-expected') {
                    const text = `${rawTestCase.rawId} Passed\r\n`;
                    runInstance.passed(testCase);
                    runInstance.appendOutput(fixLogLines(text));
                    counts.passed += 1;
                } else if (data.outcome === 'failed' || data.outcome === 'passed-unexpected') {
                    const traceback = data.traceback
                        ? data.traceback.splitLines({ trim: false, removeEmptyEntries: true }).join('\r\n')
                        : '';
                    const text = `${rawTestCase.rawId} Failed: ${data.message ?? data.outcome}\r\n${traceback}\r\n`;
                    const message = new TestMessage(text);

                    if (testCase.uri && testCase.range) {
                        message.location = new Location(testCase.uri, testCase.range);
                    }

                    runInstance.failed(testCase, message);
                    runInstance.appendOutput(fixLogLines(text));
                    counts.failed += 1;
                    if (failFast) {
                        stopTesting = true;
                    }
                } else if (data.outcome === 'error') {
                    const traceback = data.traceback
                        ? data.traceback.splitLines({ trim: false, removeEmptyEntries: true }).join('\r\n')
                        : '';
                    const text = `${rawTestCase.rawId} Failed with Error: ${data.message}\r\n${traceback}\r\n`;
                    const message = new TestMessage(text);

                    if (testCase.uri && testCase.range) {
                        message.location = new Location(testCase.uri, testCase.range);
                    }

                    runInstance.errored(testCase, message);
                    runInstance.appendOutput(fixLogLines(text));
                    counts.errored += 1;
                    if (failFast) {
                        stopTesting = true;
                    }
                } else if (data.outcome === 'skipped') {
                    const traceback = data.traceback
                        ? data.traceback.splitLines({ trim: false, removeEmptyEntries: true }).join('\r\n')
                        : '';
                    const text = `${rawTestCase.rawId} Skipped: ${data.message}\r\n${traceback}\r\n`;
                    runInstance.skipped(testCase);
                    runInstance.appendOutput(fixLogLines(text));
                    counts.skipped += 1;
                } else if (data.outcome === 'subtest-passed') {
                    const sub = subTestStats.get(data.test);
                    if (sub) {
                        sub.passed += 1;
                    } else {
                        counts.passed += 1;
                        subTestStats.set(data.test, { passed: 1, failed: 0 });
                        runInstance.appendOutput(fixLogLines(`${rawTestCase.rawId} [subtests]:\r\n`));

                        // We are seeing the first subtest for this node. Clear all other nodes under it
                        // because we have no way to detect these at discovery, they can always be different
                        // for each run.
                        clearAllChildren(testCase);
                    }
                    if (data.subtest) {
                        runInstance.appendOutput(fixLogLines(`${data.subtest} Passed\r\n`));

                        // This is a runtime only node for unittest subtest, since they can only be detected
                        // at runtime. So, create a fresh one for each result.
                        const subtest = testController?.createTestItem(data.subtest, data.subtest);
                        if (subtest) {
                            testCase.children.add(subtest);
                            runInstance.started(subtest);
                            runInstance.passed(subtest);
                        }
                    }
                } else if (data.outcome === 'subtest-failed') {
                    const sub = subTestStats.get(data.test);
                    if (sub) {
                        sub.failed += 1;
                    } else {
                        counts.failed += 1;
                        subTestStats.set(data.test, { passed: 0, failed: 1 });

                        runInstance.appendOutput(fixLogLines(`${rawTestCase.rawId} [subtests]:\r\n`));

                        // We are seeing the first subtest for this node. Clear all other nodes under it
                        // because we have no way to detect these at discovery, they can always be different
                        // for each run.
                        clearAllChildren(testCase);
                    }

                    if (data.subtest) {
                        runInstance.appendOutput(fixLogLines(`${data.subtest} Failed\r\n`));
                        const traceback = data.traceback
                            ? data.traceback.splitLines({ trim: false, removeEmptyEntries: true }).join('\r\n')
                            : '';
                        const text = `${data.subtest} Failed: ${data.message ?? data.outcome}\r\n${traceback}\r\n`;
                        runInstance.appendOutput(fixLogLines(text));

                        // This is a runtime only node for unittest subtest, since they can only be detected
                        // at runtime. So, create a fresh one for each result.
                        const subtest = testController?.createTestItem(data.subtest, data.subtest);
                        if (subtest) {
                            testCase.children.add(subtest);
                            runInstance.started(subtest);
                            const message = new TestMessage(text);
                            if (testCase.uri && testCase.range) {
                                message.location = new Location(testCase.uri, testCase.range);
                            }

                            runInstance.failed(subtest, message);
                        }
                    }
                } else {
                    const text = `Unknown outcome type for test ${rawTestCase.rawId}: ${data.outcome}`;
                    runInstance.appendOutput(fixLogLines(text));
                    const message = new TestMessage(text);
                    if (testCase.uri && testCase.range) {
                        message.location = new Location(testCase.uri, testCase.range);
                    }
                    runInstance.errored(testCase, message);
                }
            } else if (data.outcome === 'error') {
                const traceback = data.traceback
                    ? data.traceback.splitLines({ trim: false, removeEmptyEntries: true }).join('\r\n')
                    : '';
                const text = `${data.test} Failed with Error: ${data.message}\r\n${traceback}\r\n`;
                runInstance.appendOutput(fixLogLines(text));
            }
        });

        const port = await this.server.start();
        const runTestInternal = async (testFilePath: string, testRunIds: string[]): Promise<void> => {
            let testArgs = getTestRunArgs(options.args);
            failFast = testArgs.indexOf('--uf') >= 0;
            testArgs = testArgs.filter((arg) => arg !== '--uf');

            testArgs.push(`--result-port=${port}`);
            testRunIds.forEach((i) => testArgs.push(`-t${i}`));
            testArgs.push(`--testFile=${testFilePath}`);

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
            for (const testFile of fileToTestCases.keys()) {
                if (stopTesting || options.token.isCancellationRequested) {
                    break;
                }

                const nodes = fileToTestCases.get(testFile);
                if (nodes) {
                    runInstance.appendOutput(`Running tests: ${nodes.map((n) => n.id).join('\r\n')}\r\n`);
                    const runIds: string[] = [];
                    nodes.forEach((n) => {
                        const rawNode = idToRawData.get(n.id);
                        if (rawNode) {
                            // VS Code API requires that we set the run state on the leaf nodes. The state of the
                            // parent nodes are computed based on the state of child nodes.
                            runInstance.started(n);
                            runIds.push(rawNode.runId);
                        }
                    });
                    await runTestInternal(testFile, runIds);
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
        runInstance.appendOutput(`Total number of tests skipped: ${counts.skipped}\r\n\r\n`);

        if (subTestStats.size > 0) {
            runInstance.appendOutput('Sub-test stats: \r\n');
        }

        subTestStats.forEach((v, k) => {
            runInstance.appendOutput(
                `Sub-tests for [${k}]: Total=${v.passed + v.failed} Passed=${v.passed} Failed=${v.failed}\r\n\r\n`,
            );
        });

        if (failFast) {
            runInstance.appendOutput(
                `Total number of tests skipped due to fail fast: ${counts.total - tested.length}\r\n`,
            );
        }
    }
}
