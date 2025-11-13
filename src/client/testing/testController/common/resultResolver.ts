// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    CancellationToken,
    TestController,
    TestItem,
    Uri,
    TestMessage,
    Location,
    TestRun,
    MarkdownString,
    TestCoverageCount,
    FileCoverage,
    FileCoverageDetail,
    StatementCoverage,
    Range,
} from 'vscode';
import * as util from 'util';
import {
    CoveragePayload,
    DiscoveredTestPayload,
    ExecutionTestPayload,
    FileCoverageMetrics,
    ITestResultResolver,
} from './types';
import { TestProvider } from '../../types';
import { traceError, traceVerbose } from '../../../logging';
import { Testing } from '../../../common/utils/localize';
import { clearAllChildren, createErrorTestItem, getTestCaseNodes } from './testItemUtilities';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { splitLines } from '../../../common/stringUtils';
import { buildErrorNodeOptions, populateTestTree, splitTestNameWithRegex } from './utils';

export class PythonResultResolver implements ITestResultResolver {
    testController: TestController;

    testProvider: TestProvider;

    public runIdToTestItem: Map<string, TestItem>;

    public runIdToVSid: Map<string, string>;

    public vsIdToRunId: Map<string, string>;

    public subTestStats: Map<string, { passed: number; failed: number }> = new Map();

    public detailedCoverageMap = new Map<string, FileCoverageDetail[]>();

    constructor(testController: TestController, testProvider: TestProvider, private workspaceUri: Uri) {
        this.testController = testController;
        this.testProvider = testProvider;

        this.runIdToTestItem = new Map<string, TestItem>();
        this.runIdToVSid = new Map<string, string>();
        this.vsIdToRunId = new Map<string, string>();
    }

    public resolveDiscovery(payload: DiscoveredTestPayload, token?: CancellationToken): void {
        if (!payload) {
            // No test data is available
        } else {
            this._resolveDiscovery(payload as DiscoveredTestPayload, token);
        }
    }

    public _resolveDiscovery(payload: DiscoveredTestPayload, token?: CancellationToken): void {
        const workspacePath = this.workspaceUri.fsPath;
        const rawTestData = payload as DiscoveredTestPayload;
        // Check if there were any errors in the discovery process.
        if (rawTestData.status === 'error') {
            const testingErrorConst =
                this.testProvider === 'pytest' ? Testing.errorPytestDiscovery : Testing.errorUnittestDiscovery;
            const { error } = rawTestData;
            traceError(testingErrorConst, 'for workspace: ', workspacePath, '\r\n', error?.join('\r\n\r\n') ?? '');

            let errorNode = this.testController.items.get(`DiscoveryError:${workspacePath}`);
            const message = util.format(
                `${testingErrorConst} ${Testing.seePythonOutput}\r\n`,
                error?.join('\r\n\r\n') ?? '',
            );

            if (errorNode === undefined) {
                const options = buildErrorNodeOptions(this.workspaceUri, message, this.testProvider);
                errorNode = createErrorTestItem(this.testController, options);
                this.testController.items.add(errorNode);
            }
            const errorNodeLabel: MarkdownString = new MarkdownString(
                `[Show output](command:python.viewOutput) to view error logs`,
            );
            errorNodeLabel.isTrusted = true;
            errorNode.error = errorNodeLabel;
        } else {
            // remove error node only if no errors exist.
            this.testController.items.delete(`DiscoveryError:${workspacePath}`);
        }
        if (rawTestData.tests || rawTestData.tests === null) {
            // if any tests exist, they should be populated in the test tree, regardless of whether there were errors or not.
            // parse and insert test data.

            // Clear existing mappings before rebuilding test tree
            this.runIdToTestItem.clear();
            this.runIdToVSid.clear();
            this.vsIdToRunId.clear();

            // If the test root for this folder exists: Workspace refresh, update its children.
            // Otherwise, it is a freshly discovered workspace, and we need to create a new test root and populate the test tree.
            populateTestTree(this.testController, rawTestData.tests, undefined, this, token);
        }

        sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_DONE, undefined, {
            tool: this.testProvider,
            failed: false,
        });
    }

    public resolveExecution(payload: ExecutionTestPayload | CoveragePayload, runInstance: TestRun): void {
        if ('coverage' in payload) {
            // coverage data is sent once per connection
            traceVerbose('Coverage data received.');
            this._resolveCoverage(payload as CoveragePayload, runInstance);
        } else {
            this._resolveExecution(payload as ExecutionTestPayload, runInstance);
        }
    }

    public _resolveCoverage(payload: CoveragePayload, runInstance: TestRun): void {
        if (payload.result === undefined) {
            return;
        }
        for (const [key, value] of Object.entries(payload.result)) {
            const fileNameStr = key;
            const fileCoverageMetrics: FileCoverageMetrics = value;
            const linesCovered = fileCoverageMetrics.lines_covered ? fileCoverageMetrics.lines_covered : []; // undefined if no lines covered
            const linesMissed = fileCoverageMetrics.lines_missed ? fileCoverageMetrics.lines_missed : []; // undefined if no lines missed
            const executedBranches = fileCoverageMetrics.executed_branches;
            const totalBranches = fileCoverageMetrics.total_branches;

            const lineCoverageCount = new TestCoverageCount(
                linesCovered.length,
                linesCovered.length + linesMissed.length,
            );
            let fileCoverage: FileCoverage;
            const uri = Uri.file(fileNameStr);
            if (totalBranches === -1) {
                // branch coverage was not enabled and should not be displayed
                fileCoverage = new FileCoverage(uri, lineCoverageCount);
            } else {
                const branchCoverageCount = new TestCoverageCount(executedBranches, totalBranches);
                fileCoverage = new FileCoverage(uri, lineCoverageCount, branchCoverageCount);
            }
            runInstance.addCoverage(fileCoverage);

            // create detailed coverage array for each file (only line coverage on detailed, not branch)
            const detailedCoverageArray: FileCoverageDetail[] = [];
            // go through all covered lines, create new StatementCoverage, and add to detailedCoverageArray
            for (const line of linesCovered) {
                // line is 1-indexed, so we need to subtract 1 to get the 0-indexed line number
                // true value means line is covered
                const statementCoverage = new StatementCoverage(
                    true,
                    new Range(line - 1, 0, line - 1, Number.MAX_SAFE_INTEGER),
                );
                detailedCoverageArray.push(statementCoverage);
            }
            for (const line of linesMissed) {
                // line is 1-indexed, so we need to subtract 1 to get the 0-indexed line number
                // false value means line is NOT covered
                const statementCoverage = new StatementCoverage(
                    false,
                    new Range(line - 1, 0, line - 1, Number.MAX_SAFE_INTEGER),
                );
                detailedCoverageArray.push(statementCoverage);
            }

            this.detailedCoverageMap.set(uri.fsPath, detailedCoverageArray);
        }
    }

    /**
     * Collect all test case items from the test controller tree.
     * Note: This performs full tree traversal - use cached lookups when possible.
     */
    private collectAllTestCases(): TestItem[] {
        const testCases: TestItem[] = [];

        this.testController.items.forEach((i) => {
            const tempArr: TestItem[] = getTestCaseNodes(i);
            testCases.push(...tempArr);
        });

        return testCases;
    }

    /**
     * Find a test item efficiently using cached maps with fallback strategies.
     * Uses a three-tier approach: direct lookup, ID mapping, then tree search.
     */
    private findTestItemByIdEfficient(keyTemp: string): TestItem | undefined {
        // Try direct O(1) lookup first
        const directItem = this.runIdToTestItem.get(keyTemp);
        if (directItem) {
            // Validate the item is still in the test tree
            if (this.isTestItemValid(directItem)) {
                return directItem;
            } else {
                // Clean up stale reference
                this.runIdToTestItem.delete(keyTemp);
            }
        }

        // Try vsId mapping as fallback
        const vsId = this.runIdToVSid.get(keyTemp);
        if (vsId) {
            // Search by VS Code ID in the controller
            let foundItem: TestItem | undefined;
            this.testController.items.forEach((item) => {
                if (item.id === vsId) {
                    foundItem = item;
                    return;
                }
                if (!foundItem) {
                    item.children.forEach((child) => {
                        if (child.id === vsId) {
                            foundItem = child;
                        }
                    });
                }
            });

            if (foundItem) {
                // Cache for future lookups
                this.runIdToTestItem.set(keyTemp, foundItem);
                return foundItem;
            } else {
                // Clean up stale mapping
                this.runIdToVSid.delete(keyTemp);
                this.vsIdToRunId.delete(vsId);
            }
        }

        // Last resort: full tree search
        traceError(`Falling back to tree search for test: ${keyTemp}`);
        const testCases = this.collectAllTestCases();
        return testCases.find((item) => item.id === vsId);
    }

    /**
     * Check if a TestItem is still valid (exists in the TestController tree)
     *
     * Time Complexity: O(depth) where depth is the maximum nesting level of the test tree.
     * In most cases this is O(1) to O(3) since test trees are typically shallow.
     */
    private isTestItemValid(testItem: TestItem): boolean {
        // Simple validation: check if the item's parent chain leads back to the controller
        let current: TestItem | undefined = testItem;
        while (current?.parent) {
            current = current.parent;
        }

        // If we reached a root item, check if it's in the controller
        if (current) {
            return this.testController.items.get(current.id) === current;
        }

        // If no parent chain, check if it's directly in the controller
        return this.testController.items.get(testItem.id) === testItem;
    }

    /**
     * Clean up stale test item references from the cache maps.
     * Validates cached items and removes any that are no longer in the test tree.
     */
    public cleanupStaleReferences(): void {
        const staleRunIds: string[] = [];

        // Check all runId->TestItem mappings
        this.runIdToTestItem.forEach((testItem, runId) => {
            if (!this.isTestItemValid(testItem)) {
                staleRunIds.push(runId);
            }
        });

        // Remove stale entries
        staleRunIds.forEach((runId) => {
            const vsId = this.runIdToVSid.get(runId);
            this.runIdToTestItem.delete(runId);
            this.runIdToVSid.delete(runId);
            if (vsId) {
                this.vsIdToRunId.delete(vsId);
            }
        });

        if (staleRunIds.length > 0) {
            traceVerbose(`Cleaned up ${staleRunIds.length} stale test item references`);
        }
    }

    /**
     * Handle test items that errored during execution.
     * Extracts error details, finds the corresponding TestItem, and reports the error to VS Code's Test Explorer.
     */
    private handleTestError(keyTemp: string, testItem: any, runInstance: TestRun): void {
        const rawTraceback = testItem.traceback ?? '';
        const traceback = splitLines(rawTraceback, {
            trim: false,
            removeEmptyEntries: true,
        }).join('\r\n');
        const text = `${testItem.test} failed with error: ${testItem.message ?? testItem.outcome}\r\n${traceback}`;
        const message = new TestMessage(text);

        const foundItem = this.findTestItemByIdEfficient(keyTemp);

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
    private handleTestFailure(keyTemp: string, testItem: any, runInstance: TestRun): void {
        const rawTraceback = testItem.traceback ?? '';
        const traceback = splitLines(rawTraceback, {
            trim: false,
            removeEmptyEntries: true,
        }).join('\r\n');

        const text = `${testItem.test} failed: ${testItem.message ?? testItem.outcome}\r\n${traceback}`;
        const message = new TestMessage(text);

        const foundItem = this.findTestItemByIdEfficient(keyTemp);

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
    private handleTestSuccess(keyTemp: string, runInstance: TestRun): void {
        const grabTestItem = this.runIdToTestItem.get(keyTemp);

        if (grabTestItem !== undefined) {
            const foundItem = this.findTestItemByIdEfficient(keyTemp);
            if (foundItem?.uri) {
                runInstance.passed(grabTestItem);
            }
        }
    }

    /**
     * Handle test items that were skipped during execution
     */
    private handleTestSkipped(keyTemp: string, runInstance: TestRun): void {
        const grabTestItem = this.runIdToTestItem.get(keyTemp);

        if (grabTestItem !== undefined) {
            const foundItem = this.findTestItemByIdEfficient(keyTemp);
            if (foundItem?.uri) {
                runInstance.skipped(grabTestItem);
            }
        }
    }

    /**
     * Handle subtest failures
     */
    private handleSubtestFailure(keyTemp: string, testItem: any, runInstance: TestRun): void {
        const [parentTestCaseId, subtestId] = splitTestNameWithRegex(keyTemp);
        const parentTestItem = this.runIdToTestItem.get(parentTestCaseId);

        if (parentTestItem) {
            const subtestStats = this.subTestStats.get(parentTestCaseId);
            if (subtestStats) {
                subtestStats.failed += 1;
            } else {
                this.subTestStats.set(parentTestCaseId, {
                    failed: 1,
                    passed: 0,
                });
                clearAllChildren(parentTestItem);
            }

            const subTestItem = this.testController?.createTestItem(subtestId, subtestId, parentTestItem.uri);

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
    private handleSubtestSuccess(keyTemp: string, runInstance: TestRun): void {
        const [parentTestCaseId, subtestId] = splitTestNameWithRegex(keyTemp);
        const parentTestItem = this.runIdToTestItem.get(parentTestCaseId);

        if (parentTestItem) {
            const subtestStats = this.subTestStats.get(parentTestCaseId);
            if (subtestStats) {
                subtestStats.passed += 1;
            } else {
                this.subTestStats.set(parentTestCaseId, { failed: 0, passed: 1 });
                clearAllChildren(parentTestItem);
            }

            const subTestItem = this.testController?.createTestItem(subtestId, subtestId, parentTestItem.uri);

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

    /**
     * Process test execution results and update VS Code's Test Explorer with outcomes.
     * Uses efficient lookup methods to handle large numbers of test results.
     */
    public _resolveExecution(payload: ExecutionTestPayload, runInstance: TestRun): void {
        const rawTestExecData = payload as ExecutionTestPayload;
        if (rawTestExecData !== undefined && rawTestExecData.result !== undefined) {
            for (const keyTemp of Object.keys(rawTestExecData.result)) {
                const testItem = rawTestExecData.result[keyTemp];

                // Delegate to specific outcome handlers using efficient lookups
                if (testItem.outcome === 'error') {
                    this.handleTestError(keyTemp, testItem, runInstance);
                } else if (testItem.outcome === 'failure' || testItem.outcome === 'passed-unexpected') {
                    this.handleTestFailure(keyTemp, testItem, runInstance);
                } else if (testItem.outcome === 'success' || testItem.outcome === 'expected-failure') {
                    this.handleTestSuccess(keyTemp, runInstance);
                } else if (testItem.outcome === 'skipped') {
                    this.handleTestSkipped(keyTemp, runInstance);
                } else if (testItem.outcome === 'subtest-failure') {
                    this.handleSubtestFailure(keyTemp, testItem, runInstance);
                } else if (testItem.outcome === 'subtest-success') {
                    this.handleSubtestSuccess(keyTemp, runInstance);
                }
            }
        }
    }
}
