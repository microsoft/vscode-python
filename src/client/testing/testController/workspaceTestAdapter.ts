// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as util from 'util';
import { CancellationToken, TestController, TestItem, TestMessage, TestRun, Uri, Location } from 'vscode';
import { splitLines } from '../../common/stringUtils';
import { createDeferred, Deferred } from '../../common/utils/async';
import { Testing } from '../../common/utils/localize';
import { traceError, traceVerbose } from '../../logging';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { TestProvider } from '../types';
import { clearAllChildren, createErrorTestItem, getTestCaseNodes } from './common/testItemUtilities';
import { ITestDiscoveryAdapter, ITestExecutionAdapter } from './common/types';
import { fixLogLines } from './common/utils';
import { IPythonExecutionFactory } from '../../common/process/types';
import { buildErrorNodeOptions } from './common/resultResolver';

/**
 * This class exposes a test-provider-agnostic way of discovering tests.
 *
 * It gets instantiated by the `PythonTestController` class in charge of reflecting test data in the UI,
 * and then instantiates provider-specific adapters under the hood depending on settings.
 *
 * This class formats the JSON test data returned by the `[Unittest|Pytest]TestDiscoveryAdapter` into test UI elements,
 * and uses them to insert/update/remove items in the `TestController` instance behind the testing UI whenever the `PythonTestController` requests a refresh.
 */
export class WorkspaceTestAdapter {
    private discovering: Deferred<void> | undefined;

    private executing: Deferred<void> | undefined;

    runIdToTestItem: Map<string, TestItem>;

    runIdToVSid: Map<string, string>;

    vsIdToRunId: Map<string, string>;

    constructor(
        private testProvider: TestProvider,
        private discoveryAdapter: ITestDiscoveryAdapter,
        private executionAdapter: ITestExecutionAdapter,
        private workspaceUri: Uri,
    ) {
        this.runIdToTestItem = new Map<string, TestItem>();
        this.runIdToVSid = new Map<string, string>();
        this.vsIdToRunId = new Map<string, string>();
    }

    public async executeTests(
        testController: TestController,
        runInstance: TestRun,
        includes: TestItem[],
        token?: CancellationToken,
        debugBool?: boolean,
        executionFactory?: IPythonExecutionFactory,
    ): Promise<void> {
        if (this.executing) {
            return this.executing.promise;
        }

        const deferred = createDeferred<void>();
        this.executing = deferred;

        let rawTestExecData;
        const testCaseNodes: TestItem[] = [];
        const testCaseIds: string[] = [];
        try {
            // first fetch all the individual test Items that we necessarily want
            includes.forEach((t) => {
                const nodes = getTestCaseNodes(t);
                testCaseNodes.push(...nodes);
            });
            // iterate through testItems nodes and fetch their unittest runID to pass in as argument
            testCaseNodes.forEach((node) => {
                runInstance.started(node); // do the vscode ui test item start here before runtest
                const runId = this.vsIdToRunId.get(node.id);
                if (runId) {
                    testCaseIds.push(runId);
                }
            });

            // ** execution factory only defined for new rewrite way
            if (executionFactory !== undefined) {
                rawTestExecData = await this.executionAdapter.runTests(
                    this.workspaceUri,
                    testCaseIds,
                    debugBool,
                    executionFactory,
                );
                traceVerbose('executionFactory defined');
            } else {
                rawTestExecData = await this.executionAdapter.runTests(this.workspaceUri, testCaseIds, debugBool);
            }
            deferred.resolve();
        } catch (ex) {
            // handle token and telemetry here
            sendTelemetryEvent(EventName.UNITTEST_RUN_ALL_FAILED, undefined);

            let cancel = token?.isCancellationRequested
                ? Testing.cancelUnittestExecution
                : Testing.errorUnittestExecution;
            if (this.testProvider === 'pytest') {
                cancel = token?.isCancellationRequested ? Testing.cancelPytestExecution : Testing.errorPytestExecution;
            }
            traceError(`${cancel}\r\n`, ex);

            // Also report on the test view
            const message = util.format(`${cancel} ${Testing.seePythonOutput}\r\n`, ex);
            const options = buildErrorNodeOptions(this.workspaceUri, message, this.testProvider);
            const errorNode = createErrorTestItem(testController, options);
            testController.items.add(errorNode);

            deferred.reject(ex as Error);
        } finally {
            this.executing = undefined;
        }

        if (rawTestExecData !== undefined && rawTestExecData.result !== undefined) {
            // Map which holds the subtest information for each test item.
            const subTestStats: Map<string, { passed: number; failed: number }> = new Map();

            // iterate through payload and update the UI accordingly.
            for (const keyTemp of Object.keys(rawTestExecData.result)) {
                const testCases: TestItem[] = [];

                // grab leaf level test items
                testController.items.forEach((i) => {
                    const tempArr: TestItem[] = getTestCaseNodes(i);
                    testCases.push(...tempArr);
                });

                if (
                    rawTestExecData.result[keyTemp].outcome === 'failure' ||
                    rawTestExecData.result[keyTemp].outcome === 'passed-unexpected'
                ) {
                    const rawTraceback = rawTestExecData.result[keyTemp].traceback ?? '';
                    const traceback = splitLines(rawTraceback, {
                        trim: false,
                        removeEmptyEntries: true,
                    }).join('\r\n');

                    const text = `${rawTestExecData.result[keyTemp].test} failed: ${
                        rawTestExecData.result[keyTemp].message ?? rawTestExecData.result[keyTemp].outcome
                    }\r\n${traceback}\r\n`;
                    const message = new TestMessage(text);

                    // note that keyTemp is a runId for unittest library...
                    const grabVSid = this.runIdToVSid.get(keyTemp);
                    // search through freshly built array of testItem to find the failed test and update UI.
                    testCases.forEach((indiItem) => {
                        if (indiItem.id === grabVSid) {
                            if (indiItem.uri && indiItem.range) {
                                message.location = new Location(indiItem.uri, indiItem.range);
                                runInstance.failed(indiItem, message);
                                runInstance.appendOutput(fixLogLines(text));
                            }
                        }
                    });
                } else if (
                    rawTestExecData.result[keyTemp].outcome === 'success' ||
                    rawTestExecData.result[keyTemp].outcome === 'expected-failure'
                ) {
                    const grabTestItem = this.runIdToTestItem.get(keyTemp);
                    const grabVSid = this.runIdToVSid.get(keyTemp);
                    if (grabTestItem !== undefined) {
                        testCases.forEach((indiItem) => {
                            if (indiItem.id === grabVSid) {
                                if (indiItem.uri && indiItem.range) {
                                    runInstance.passed(grabTestItem);
                                    runInstance.appendOutput('Passed here');
                                }
                            }
                        });
                    }
                } else if (rawTestExecData.result[keyTemp].outcome === 'skipped') {
                    const grabTestItem = this.runIdToTestItem.get(keyTemp);
                    const grabVSid = this.runIdToVSid.get(keyTemp);
                    if (grabTestItem !== undefined) {
                        testCases.forEach((indiItem) => {
                            if (indiItem.id === grabVSid) {
                                if (indiItem.uri && indiItem.range) {
                                    runInstance.skipped(grabTestItem);
                                    runInstance.appendOutput('Skipped here');
                                }
                            }
                        });
                    }
                } else if (rawTestExecData.result[keyTemp].outcome === 'subtest-failure') {
                    // split on " " since the subtest ID has the parent test ID in the first part of the ID.
                    const parentTestCaseId = keyTemp.split(' ')[0];
                    const parentTestItem = this.runIdToTestItem.get(parentTestCaseId);
                    const data = rawTestExecData.result[keyTemp];
                    // find the subtest's parent test item
                    if (parentTestItem) {
                        const subtestStats = subTestStats.get(parentTestCaseId);
                        if (subtestStats) {
                            subtestStats.failed += 1;
                        } else {
                            subTestStats.set(parentTestCaseId, { failed: 1, passed: 0 });
                            runInstance.appendOutput(fixLogLines(`${parentTestCaseId} [subtests]:\r\n`));
                            // clear since subtest items don't persist between runs
                            clearAllChildren(parentTestItem);
                        }
                        const subtestId = keyTemp;
                        const subTestItem = testController?.createTestItem(subtestId, subtestId);
                        runInstance.appendOutput(fixLogLines(`${subtestId} Failed\r\n`));
                        // create a new test item for the subtest
                        if (subTestItem) {
                            const traceback = data.traceback ?? '';
                            const text = `${data.subtest} Failed: ${data.message ?? data.outcome}\r\n${traceback}\r\n`;
                            runInstance.appendOutput(fixLogLines(text));
                            parentTestItem.children.add(subTestItem);
                            runInstance.started(subTestItem);
                            const message = new TestMessage(rawTestExecData?.result[keyTemp].message ?? '');
                            if (parentTestItem.uri && parentTestItem.range) {
                                message.location = new Location(parentTestItem.uri, parentTestItem.range);
                            }
                            runInstance.failed(subTestItem, message);
                        } else {
                            throw new Error('Unable to create new child node for subtest');
                        }
                    } else {
                        throw new Error('Parent test item not found');
                    }
                } else if (rawTestExecData.result[keyTemp].outcome === 'subtest-success') {
                    // split on " " since the subtest ID has the parent test ID in the first part of the ID.
                    const parentTestCaseId = keyTemp.split(' ')[0];
                    const parentTestItem = this.runIdToTestItem.get(parentTestCaseId);

                    // find the subtest's parent test item
                    if (parentTestItem) {
                        const subtestStats = subTestStats.get(parentTestCaseId);
                        if (subtestStats) {
                            subtestStats.passed += 1;
                        } else {
                            subTestStats.set(parentTestCaseId, { failed: 0, passed: 1 });
                            runInstance.appendOutput(fixLogLines(`${parentTestCaseId} [subtests]:\r\n`));
                            // clear since subtest items don't persist between runs
                            clearAllChildren(parentTestItem);
                        }
                        const subtestId = keyTemp;
                        const subTestItem = testController?.createTestItem(subtestId, subtestId);
                        // create a new test item for the subtest
                        if (subTestItem) {
                            parentTestItem.children.add(subTestItem);
                            runInstance.started(subTestItem);
                            runInstance.passed(subTestItem);
                            runInstance.appendOutput(fixLogLines(`${subtestId} Passed\r\n`));
                        } else {
                            throw new Error('Unable to create new child node for subtest');
                        }
                    } else {
                        throw new Error('Parent test item not found');
                    }
                }
            }
        }
        return Promise.resolve();
    }

    public async discoverTests(
        testController: TestController,
        token?: CancellationToken,
        isMultiroot?: boolean,
        workspaceFilePath?: string,
        executionFactory?: IPythonExecutionFactory,
    ): Promise<void> {
        sendTelemetryEvent(EventName.UNITTEST_DISCOVERING, undefined, { tool: this.testProvider });

        // Discovery is expensive. If it is already running, use the existing promise.
        if (this.discovering) {
            return this.discovering.promise;
        }

        const deferred = createDeferred<void>();
        this.discovering = deferred;

        try {
            // ** execution factory only defined for new rewrite way
            if (executionFactory !== undefined) {
                await this.discoveryAdapter.discoverTests(this.workspaceUri, executionFactory);
            } else {
                await this.discoveryAdapter.discoverTests(this.workspaceUri);
            }
            deferred.resolve();
        } catch (ex) {
            sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_DONE, undefined, { tool: this.testProvider, failed: true });

            let cancel = token?.isCancellationRequested
                ? Testing.cancelUnittestDiscovery
                : Testing.errorUnittestDiscovery;
            if (this.testProvider === 'pytest') {
                cancel = token?.isCancellationRequested ? Testing.cancelPytestDiscovery : Testing.errorPytestDiscovery;
            }

            traceError(`${cancel}\r\n`, ex);

            // Report also on the test view.
            const message = util.format(`${cancel} ${Testing.seePythonOutput}\r\n`, ex);
            const options = buildErrorNodeOptions(this.workspaceUri, message, this.testProvider);
            const errorNode = createErrorTestItem(testController, options);
            testController.items.add(errorNode);

            deferred.reject(ex as Error);
        } finally {
            // Discovery has finished running, we have the data,
            // we don't need the deferred promise anymore.
            this.discovering = undefined;
        }
        return Promise.resolve();
    }
}
