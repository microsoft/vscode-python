// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, TestController, TestItem, Uri, TestRun, FileCoverageDetail } from 'vscode';
import { CoveragePayload, DiscoveredTestPayload, ExecutionTestPayload, ITestResultResolver } from './types';
import { TestProvider } from '../../types';
import { traceInfo } from '../../../logging';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { TestItemIndex } from './testItemIndex';
import { TestDiscoveryHandler } from './testDiscoveryHandler';
import { TestExecutionHandler } from './testExecutionHandler';
import { TestCoverageHandler } from './testCoverageHandler';

export class PythonResultResolver implements ITestResultResolver {
    testController: TestController;

    testProvider: TestProvider;

    private testItemIndex: TestItemIndex;

    // Shared singleton handlers
    private static discoveryHandler: TestDiscoveryHandler = new TestDiscoveryHandler();
    private static executionHandler: TestExecutionHandler = new TestExecutionHandler();
    private static coverageHandler: TestCoverageHandler = new TestCoverageHandler();

    public detailedCoverageMap = new Map<string, FileCoverageDetail[]>();

    constructor(testController: TestController, testProvider: TestProvider, private workspaceUri: Uri) {
        this.testController = testController;
        this.testProvider = testProvider;
        // Initialize a new TestItemIndex which will be used to track test items in this workspace
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

    public resolveDiscovery(payload: DiscoveredTestPayload, token?: CancellationToken): void {
        PythonResultResolver.discoveryHandler.processDiscovery(
            payload,
            this.testController,
            this.testItemIndex,
            this.workspaceUri,
            this.testProvider,
            token,
        );
        sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_DONE, undefined, {
            tool: this.testProvider,
            failed: false,
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
