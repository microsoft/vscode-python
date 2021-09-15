// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable, inject, named } from 'inversify';
import { Location, TestItem, TestMessage, TestRun, TestRunProfileKind } from 'vscode';
import { traceError, traceInfo } from '../../../common/logger';
import * as internalScripts from '../../../common/process/internal/scripts';
import { IOutputChannel } from '../../../common/types';
import { noop } from '../../../common/utils/misc';
import { UNITTEST_PROVIDER } from '../../common/constants';
import { ITestRunner, ITestDebugLauncher, IUnitTestSocketServer, LaunchOptions, Options } from '../../common/types';
import { TEST_OUTPUT_CHANNEL } from '../../constants';
import { getTestCaseNodes } from '../common/testItemUtilities';
import { ITestRun, ITestsRunner, TestData, TestRunInstanceOptions, TestRunOptions } from '../common/types';
import { fixLogLines } from '../common/utils';
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
        testRun: ITestRun,
        options: TestRunOptions,
        idToRawData: Map<string, TestData>,
    ): Promise<void> {
        const runOptions: TestRunInstanceOptions = {
            ...options,
            exclude: testRun.excludes,
            debug: testRun.runKind === TestRunProfileKind.Debug,
        };

        try {
            await this.runTest(testRun.includes, testRun.runInstance, runOptions, idToRawData);
        } catch (ex) {
            testRun.runInstance.appendOutput(`Error while running tests:\r\n${ex}\r\n\r\n`);
        }
    }

    private async runTest(
        testNodes: TestItem[],
        runInstance: TestRun,
        options: TestRunInstanceOptions,
        idToRawData: Map<string, TestData>,
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
            traceInfo(`${message} ${data.join(' ')}`);
        });
        this.server.on('connect', noop);
        this.server.on('start', noop);
        this.server.on('result', (data: ITestData) => {
            const testCase = testCaseNodes.find((node) => idToRawData.get(node.id)?.runId === data.test);
            const rawTestCase = idToRawData.get(testCase?.id ?? '');
            if (testCase && rawTestCase) {
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
                } else {
                    const text = `Unknown outcome type for test ${rawTestCase.rawId}: ${data.outcome}`;
                    runInstance.appendOutput(fixLogLines(text));
                    const message = new TestMessage(text);
                    if (testCase.uri && testCase.range) {
                        message.location = new Location(testCase.uri, testCase.range);
                    }
                    runInstance.errored(testCase, message);
                }
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
                    runInstance.appendOutput(`Running tests: ${nodes.join('\r\n')}\r\n`);
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
        runInstance.appendOutput(`Total number of tests skipped: ${counts.skipped}\r\n`);

        if (failFast) {
            runInstance.appendOutput(
                `Total number of tests skipped due to fail fast: ${counts.total - tested.length}\r\n`,
            );
        }
    }
}
