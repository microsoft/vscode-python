// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestController, TestItem } from 'vscode';
import { traceError, traceVerbose } from '../../../logging';
import { getTestCaseNodes } from './testItemUtilities';

/**
 * Maintains persistent ID mappings between Python test IDs and VS Code TestItems.
 * This is a stateful component that bridges discovery and execution phases.
 *
 * Lifecycle:
 * - Created: When PythonResultResolver is instantiated (during workspace activation)
 * - Populated: During discovery - each discovered test registers its mappings
 * - Queried: During execution - to look up TestItems by Python run ID
 * - Cleared: When discovery runs again (fresh start) or workspace is disposed
 * - Cleaned: Periodically to remove stale references to deleted tests
 */
export class TestItemIndex {
    // THE STATE - these maps persist across discovery and execution
    private runIdToTestItem: Map<string, TestItem>;
    private runIdToVSid: Map<string, string>;
    private vsIdToRunId: Map<string, string>;

    constructor() {
        this.runIdToTestItem = new Map<string, TestItem>();
        this.runIdToVSid = new Map<string, string>();
        this.vsIdToRunId = new Map<string, string>();
    }

    /**
     * Register a test item with its Python run ID and VS Code ID
     * Called during DISCOVERY to populate the index
     */
    public registerTestItem(runId: string, vsId: string, testItem: TestItem): void {
        this.runIdToTestItem.set(runId, testItem);
        this.runIdToVSid.set(runId, vsId);
        this.vsIdToRunId.set(vsId, runId);
    }

    /**
     * Get TestItem by Python run ID (with validation and fallback strategies)
     * Called during EXECUTION to look up tests
     *
     * Uses a three-tier approach:
     * 1. Direct O(1) lookup in runIdToTestItem map
     * 2. If stale, try vsId mapping and search by VS Code ID
     * 3. Last resort: full tree search
     */
    public getTestItem(runId: string, testController: TestController): TestItem | undefined {
        // Try direct O(1) lookup first
        const directItem = this.runIdToTestItem.get(runId);
        if (directItem) {
            // Validate the item is still in the test tree
            if (this.isTestItemValid(directItem, testController)) {
                return directItem;
            } else {
                // Clean up stale reference
                this.runIdToTestItem.delete(runId);
            }
        }

        // Try vsId mapping as fallback
        const vsId = this.runIdToVSid.get(runId);
        if (vsId) {
            // Search by VS Code ID in the controller
            let foundItem: TestItem | undefined;
            testController.items.forEach((item) => {
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
                this.runIdToTestItem.set(runId, foundItem);
                return foundItem;
            } else {
                // Clean up stale mapping
                this.runIdToVSid.delete(runId);
                this.vsIdToRunId.delete(vsId);
            }
        }

        // Last resort: full tree search
        traceError(`Falling back to tree search for test: ${runId}`);
        const testCases = this.collectAllTestCases(testController);
        return testCases.find((item) => item.id === vsId);
    }

    /**
     * Get Python run ID from VS Code ID
     * Called by WorkspaceTestAdapter.executeTests() to convert selected tests to Python IDs
     */
    public getRunId(vsId: string): string | undefined {
        return this.vsIdToRunId.get(vsId);
    }

    /**
     * Get VS Code ID from Python run ID
     */
    public getVSId(runId: string): string | undefined {
        return this.runIdToVSid.get(runId);
    }

    /**
     * Check if a TestItem reference is still valid in the tree
     *
     * Time Complexity: O(depth) where depth is the maximum nesting level of the test tree.
     * In most cases this is O(1) to O(3) since test trees are typically shallow.
     */
    public isTestItemValid(testItem: TestItem, testController: TestController): boolean {
        // Simple validation: check if the item's parent chain leads back to the controller
        let current: TestItem | undefined = testItem;
        while (current?.parent) {
            current = current.parent;
        }

        // If we reached a root item, check if it's in the controller
        if (current) {
            return testController.items.get(current.id) === current;
        }

        // If no parent chain, check if it's directly in the controller
        return testController.items.get(testItem.id) === testItem;
    }

    /**
     * Remove all mappings
     * Called at the start of discovery to ensure clean state
     */
    public clear(): void {
        this.runIdToTestItem.clear();
        this.runIdToVSid.clear();
        this.vsIdToRunId.clear();
    }

    /**
     * Clean up stale references that no longer exist in the test tree
     * Called after test tree modifications
     */
    public cleanupStaleReferences(testController: TestController): void {
        const staleRunIds: string[] = [];

        // Check all runId->TestItem mappings
        this.runIdToTestItem.forEach((testItem, runId) => {
            if (!this.isTestItemValid(testItem, testController)) {
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
     * Collect all test case items from the test controller tree.
     * Note: This performs full tree traversal - use cached lookups when possible.
     */
    private collectAllTestCases(testController: TestController): TestItem[] {
        const testCases: TestItem[] = [];

        testController.items.forEach((i) => {
            const tempArr: TestItem[] = getTestCaseNodes(i);
            testCases.push(...tempArr);
        });

        return testCases;
    }

    // Expose maps for backward compatibility (read-only access)
    public get runIdToTestItemMap(): Map<string, TestItem> {
        return this.runIdToTestItem;
    }

    public get runIdToVSidMap(): Map<string, string> {
        return this.runIdToVSid;
    }

    public get vsIdToRunIdMap(): Map<string, string> {
        return this.vsIdToRunId;
    }
}
