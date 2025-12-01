// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestController, TestRun, TestMessage, Location } from 'vscode';
import { ExecutionTestPayload } from './types';
import { TestItemIndex } from './testItemIndex';
import { splitLines } from '../../../common/stringUtils';
import { splitTestNameWithRegex } from './utils';
import { clearAllChildren } from './testItemUtilities';

export interface SubtestStats {
    passed: number;
    failed: number;
}

/**
 * Stateless handler for processing execution payloads and updating TestRun instances.
 * This handler is shared across all workspaces and contains no instance state.
 */
export class TestExecutionHandler {
    /**
     * Process execution payload and update test run
     * Pure function - no instance state used
     * Returns subtest statistics for caller to manage
     */
    public processExecution(
        payload: ExecutionTestPayload,
        runInstance: TestRun,
        testItemIndex: TestItemIndex,
        testController: TestController,
    ): Map<string, SubtestStats> {
        const subtestStats = new Map<string, SubtestStats>();
        const rawTestExecData = payload as ExecutionTestPayload;

        if (rawTestExecData !== undefined && rawTestExecData.result !== undefined) {
            for (const keyTemp of Object.keys(rawTestExecData.result)) {
                const testItem = rawTestExecData.result[keyTemp];

                // Delegate to specific outcome handlers
                this.handleTestOutcome(keyTemp, testItem, runInstance, testItemIndex, testController, subtestStats);
            }
        }

        return subtestStats;
    }

    /**
     * Handle a single test result based on outcome
     */
    private handleTestOutcome(
        runId: string,
        testItem: any,
        runInstance: TestRun,
        testItemIndex: TestItemIndex,
        testController: TestController,
        subtestStats: Map<string, SubtestStats>,
    ): void {
        if (testItem.outcome === 'error') {
            this.handleTestError(runId, testItem, runInstance, testItemIndex, testController);
        } else if (testItem.outcome === 'failure' || testItem.outcome === 'passed-unexpected') {
            this.handleTestFailure(runId, testItem, runInstance, testItemIndex, testController);
        } else if (testItem.outcome === 'success' || testItem.outcome === 'expected-failure') {
            this.handleTestSuccess(runId, runInstance, testItemIndex, testController);
        } else if (testItem.outcome === 'skipped') {
            this.handleTestSkipped(runId, runInstance, testItemIndex, testController);
        } else if (testItem.outcome === 'subtest-failure') {
            this.handleSubtestFailure(runId, testItem, runInstance, testItemIndex, testController, subtestStats);
        } else if (testItem.outcome === 'subtest-success') {
            this.handleSubtestSuccess(runId, runInstance, testItemIndex, testController, subtestStats);
        }
    }

    /**
     * Handle test items that errored during execution
     */
    private handleTestError(
        runId: string,
        testItem: any,
        runInstance: TestRun,
        testItemIndex: TestItemIndex,
        testController: TestController,
    ): void {
        const rawTraceback = testItem.traceback ?? '';
        const traceback = splitLines(rawTraceback, {
            trim: false,
            removeEmptyEntries: true,
        }).join('\r\n');
        const text = `${testItem.test} failed with error: ${testItem.message ?? testItem.outcome}\r\n${traceback}`;
        const message = new TestMessage(text);

        const foundItem = testItemIndex.getTestItem(runId, testController);

        if (foundItem?.uri) {
            if (foundItem.range) {
                message.location = new Location(foundItem.uri, foundItem.range);
            }
            runInstance.errored(foundItem, message);
        }
    }

    /**
     * Handle test items that failed during execution
     */
    private handleTestFailure(
        runId: string,
        testItem: any,
        runInstance: TestRun,
        testItemIndex: TestItemIndex,
        testController: TestController,
    ): void {
        const rawTraceback = testItem.traceback ?? '';
        const traceback = splitLines(rawTraceback, {
            trim: false,
            removeEmptyEntries: true,
        }).join('\r\n');

        const text = `${testItem.test} failed: ${testItem.message ?? testItem.outcome}\r\n${traceback}`;
        const message = new TestMessage(text);

        const foundItem = testItemIndex.getTestItem(runId, testController);

        if (foundItem?.uri) {
            if (foundItem.range) {
                message.location = new Location(foundItem.uri, foundItem.range);
            }
            runInstance.failed(foundItem, message);
        }
    }

    /**
     * Handle test items that passed during execution
     */
    private handleTestSuccess(
        runId: string,
        runInstance: TestRun,
        testItemIndex: TestItemIndex,
        testController: TestController,
    ): void {
        const foundItem = testItemIndex.getTestItem(runId, testController);

        if (foundItem !== undefined && foundItem.uri) {
            runInstance.passed(foundItem);
        }
    }

    /**
     * Handle test items that were skipped during execution
     */
    private handleTestSkipped(
        runId: string,
        runInstance: TestRun,
        testItemIndex: TestItemIndex,
        testController: TestController,
    ): void {
        const foundItem = testItemIndex.getTestItem(runId, testController);

        if (foundItem !== undefined && foundItem.uri) {
            runInstance.skipped(foundItem);
        }
    }

    /**
     * Handle subtest failures
     */
    private handleSubtestFailure(
        runId: string,
        testItem: any,
        runInstance: TestRun,
        testItemIndex: TestItemIndex,
        testController: TestController,
        subtestStats: Map<string, SubtestStats>,
    ): void {
        const [parentTestCaseId, subtestId] = splitTestNameWithRegex(runId);
        const parentTestItem = testItemIndex.getTestItem(parentTestCaseId, testController);

        if (parentTestItem) {
            const stats = subtestStats.get(parentTestCaseId);
            if (stats) {
                stats.failed += 1;
            } else {
                subtestStats.set(parentTestCaseId, {
                    failed: 1,
                    passed: 0,
                });
                clearAllChildren(parentTestItem);
            }

            const subTestItem = testController?.createTestItem(subtestId, subtestId, parentTestItem.uri);

            if (subTestItem) {
                const traceback = testItem.traceback ?? '';
                const text = `${testItem.subtest} failed: ${testItem.message ?? testItem.outcome}\r\n${traceback}`;
                parentTestItem.children.add(subTestItem);
                runInstance.started(subTestItem);
                const message = new TestMessage(text);
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
    }

    /**
     * Handle subtest successes
     */
    private handleSubtestSuccess(
        runId: string,
        runInstance: TestRun,
        testItemIndex: TestItemIndex,
        testController: TestController,
        subtestStats: Map<string, SubtestStats>,
    ): void {
        const [parentTestCaseId, subtestId] = splitTestNameWithRegex(runId);
        const parentTestItem = testItemIndex.getTestItem(parentTestCaseId, testController);

        if (parentTestItem) {
            const stats = subtestStats.get(parentTestCaseId);
            if (stats) {
                stats.passed += 1;
            } else {
                subtestStats.set(parentTestCaseId, { failed: 0, passed: 1 });
                clearAllChildren(parentTestItem);
            }

            const subTestItem = testController?.createTestItem(subtestId, subtestId, parentTestItem.uri);

            if (subTestItem) {
                parentTestItem.children.add(subTestItem);
                runInstance.started(subTestItem);
                runInstance.passed(subTestItem);
            } else {
                throw new Error('Unable to create new child node for subtest');
            }
        } else {
            throw new Error('Parent test item not found');
        }
    }
}
