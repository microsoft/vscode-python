// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, TestController, TestItem, Uri, TestRun, FileCoverageDetail } from 'vscode';
import { CoveragePayload, DiscoveredTestPayload, ExecutionTestPayload, ITestResultResolver } from './types';
import { TestProvider } from '../../types';
import { traceInfo } from '../../../logging';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { StopWatch } from '../../../common/utils/stopWatch';
import { TestItemIndex } from './testItemIndex';
import { TestDiscoveryHandler } from './testDiscoveryHandler';
import { TestExecutionHandler } from './testExecutionHandler';
import { TestCoverageHandler } from './testCoverageHandler';
import { DiscoveredTestNode, DiscoveredTestItem } from './types';

/**
 * Trigger source label for the current discovery cycle (matches
 * UNITTEST_DISCOVERY_TRIGGER.trigger values).
 */
export type DiscoveryTriggerKind = 'auto' | 'ui' | 'commandpalette' | 'watching' | 'interpreter';

/**
 * Per-cycle context the controller passes to the resolver so DISCOVERY_DONE can
 * include trigger source, mode, and wall-clock duration without having to plumb
 * these through every adapter call.
 */
export interface DiscoveryCycleContext {
    mode: 'project' | 'legacy';
    trigger?: DiscoveryTriggerKind;
    stopWatch: StopWatch;
}

export class PythonResultResolver implements ITestResultResolver {
    testController: TestController;

    testProvider: TestProvider;

    private testItemIndex: TestItemIndex;

    // Shared singleton handlers
    private static discoveryHandler: TestDiscoveryHandler = new TestDiscoveryHandler();
    private static executionHandler: TestExecutionHandler = new TestExecutionHandler();
    private static coverageHandler: TestCoverageHandler = new TestCoverageHandler();

    public detailedCoverageMap = new Map<string, FileCoverageDetail[]>();

    /**
     * Optional project ID for scoping test IDs.
     * When set, all test IDs are prefixed with `{projectId}@@vsc@@` for project-based testing.
     * When undefined, uses legacy workspace-level IDs for backward compatibility.
     */
    private projectId?: string;

    /**
     * Optional project display name for labeling the test tree root.
     * When set, the root node label will be "project: {projectName}" instead of the folder name.
     */
    private projectName?: string;

    /**
     * Per-cycle telemetry context set by the controller before invoking discovery.
     * Consumed (and cleared) by resolveDiscovery to emit UNITTEST_DISCOVERY_DONE.
     */
    private discoveryCycle?: DiscoveryCycleContext;

    constructor(
        testController: TestController,
        testProvider: TestProvider,
        private workspaceUri: Uri,
        projectId?: string,
        projectName?: string,
    ) {
        this.testController = testController;
        this.testProvider = testProvider;
        this.projectId = projectId;
        this.projectName = projectName;
        // Initialize a new TestItemIndex which will be used to track test items in this workspace/project
        this.testItemIndex = new TestItemIndex();
    }

    // Expose for backward compatibility (WorkspaceTestAdapter accesses these)
    public get runIdToTestItem(): Map<string, TestItem> {
        return this.testItemIndex.runIdToTestItemMap;
    }

    public get runIdToVSid(): Map<string, string> {
        return this.testItemIndex.runIdToVSidMap;
    }

    public get vsIdToRunId(): Map<string, string> {
        return this.testItemIndex.vsIdToRunIdMap;
    }

    /**
     * Gets the project ID for this resolver (if any).
     * Used for project-scoped test ID generation.
     */
    public getProjectId(): string | undefined {
        return this.projectId;
    }

    /**
     * Set per-discovery-cycle telemetry context. Called by the controller right
     * before invoking the discovery adapter so resolveDiscovery / failure paths
     * can include trigger, mode, and duration in UNITTEST_DISCOVERY_DONE.
     */
    public beginDiscoveryCycle(ctx: Omit<DiscoveryCycleContext, 'stopWatch'>): void {
        this.discoveryCycle = { ...ctx, stopWatch: new StopWatch() };
    }

    /**
     * Returns and clears the current discovery cycle context, if any.
     */
    private takeDiscoveryCycle(): DiscoveryCycleContext | undefined {
        const cycle = this.discoveryCycle;
        this.discoveryCycle = undefined;
        return cycle;
    }

    /**
     * Returns the current discovery cycle context without clearing it.
     * Used by error paths that still want to clear via takeDiscoveryCycle.
     */
    public peekDiscoveryCycle(): DiscoveryCycleContext | undefined {
        return this.discoveryCycle;
    }

    /**
     * Clears the current discovery cycle context.
     */
    public clearDiscoveryCycle(): void {
        this.discoveryCycle = undefined;
    }

    public resolveDiscovery(payload: DiscoveredTestPayload, token?: CancellationToken): void {
        PythonResultResolver.discoveryHandler.processDiscovery(
            payload,
            this.testController,
            this.testItemIndex,
            this.workspaceUri,
            this.testProvider,
            token,
            this.projectId,
            this.projectName,
        );
        const cycle = this.takeDiscoveryCycle();
        const mode = cycle?.mode ?? (this.projectId ? 'project' : 'legacy');
        sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_DONE, undefined, {
            tool: this.testProvider,
            failed: false,
            mode,
            trigger: cycle?.trigger,
            totalDurationMs: cycle?.stopWatch.elapsedTime,
            testCount: payload?.tests ? countDiscoveredTests(payload.tests) : 0,
        });
    }

    public _resolveDiscovery(payload: DiscoveredTestPayload, token?: CancellationToken): void {
        // Delegate to the public method for backward compatibility
        this.resolveDiscovery(payload, token);
    }

    public resolveExecution(payload: ExecutionTestPayload | CoveragePayload, runInstance: TestRun): void {
        if ('coverage' in payload) {
            // coverage data is sent once per connection
            traceInfo('Coverage data received, processing...');
            this.detailedCoverageMap = PythonResultResolver.coverageHandler.processCoverage(
                payload as CoveragePayload,
                runInstance,
            );
            traceInfo('Coverage data processing complete.');
        } else {
            PythonResultResolver.executionHandler.processExecution(
                payload as ExecutionTestPayload,
                runInstance,
                this.testItemIndex,
                this.testController,
            );
        }
    }

    public _resolveExecution(payload: ExecutionTestPayload, runInstance: TestRun): void {
        // Delegate to the public method for backward compatibility
        this.resolveExecution(payload, runInstance);
    }

    public _resolveCoverage(payload: CoveragePayload, runInstance: TestRun): void {
        // Delegate to the public method for backward compatibility
        this.resolveExecution(payload, runInstance);
    }

    /**
     * Clean up stale test item references from the cache maps.
     * Validates cached items and removes any that are no longer in the test tree.
     * Delegates to TestItemIndex.
     */
    public cleanupStaleReferences(): void {
        this.testItemIndex.cleanupStaleReferences(this.testController);
    }
}

/**
 * Recursively counts leaf test items in a discovered test tree.
 * Used to populate UNITTEST_DISCOVERY_DONE.testCount.
 */
function countDiscoveredTests(node: DiscoveredTestNode | DiscoveredTestItem): number {
    if ((node as DiscoveredTestNode).children === undefined) {
        // No children -> leaf (DiscoveredTestItem).
        return 1;
    }
    let total = 0;
    for (const child of (node as DiscoveredTestNode).children) {
        total += countDiscoveredTests(child);
    }
    return total;
}
