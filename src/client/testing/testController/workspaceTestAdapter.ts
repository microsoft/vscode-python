// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as util from 'util';
import { CancellationToken, TestController, TestItem, TestRun, TestRunProfileKind, Uri } from 'vscode';
import { createDeferred, Deferred } from '../../common/utils/async';
import { Testing } from '../../common/utils/localize';
import { traceError } from '../../logging';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { TestProvider } from '../types';
import { createErrorTestItem, expandExcludeSet, getTestCaseNodes } from './common/testItemUtilities';
import { ITestDiscoveryAdapter, ITestExecutionAdapter, ITestResultResolver } from './common/types';
import { IPythonExecutionFactory } from '../../common/process/types';
import { ITestDebugLauncher } from '../common/types';
import { buildErrorNodeOptions } from './common/utils';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { ProjectAdapter } from './common/projectAdapter';

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

    constructor(
        private testProvider: TestProvider,
        private discoveryAdapter: ITestDiscoveryAdapter,
        private executionAdapter: ITestExecutionAdapter,
        private workspaceUri: Uri,
        public resultResolver: ITestResultResolver,
    ) {}

    public async executeTests(
        testController: TestController,
        runInstance: TestRun,
        includes: TestItem[],
        executionFactory: IPythonExecutionFactory,
        token?: CancellationToken,
        profileKind?: boolean | TestRunProfileKind,
        debugLauncher?: ITestDebugLauncher,
        interpreter?: PythonEnvironment,
        excludes?: readonly TestItem[],
        project?: ProjectAdapter,
    ): Promise<void> {
        if (this.executing) {
            traceError('Test execution already in progress, not starting a new one.');
            return this.executing.promise;
        }

        const deferred = createDeferred<void>();
        this.executing = deferred;

        const testCaseNodes: TestItem[] = [];
        const visitedNodes = new Set<TestItem>();
        const rawExcludeSet = excludes?.length ? new Set(excludes) : undefined;
        const excludeSet = expandExcludeSet(rawExcludeSet);
        const testCaseIds: string[] = [];
        try {
            // Expand included items to leaf test nodes.
            // getTestCaseNodes handles visited tracking and exclusion filtering.
            includes.forEach((t) => {
                getTestCaseNodes(t, testCaseNodes, visitedNodes, excludeSet);
            });
            // Collect runIDs for the test nodes to execute.
            testCaseNodes.forEach((node) => {
                runInstance.started(node);
                const runId = this.resultResolver.vsIdToRunId.get(node.id);
                if (runId) {
                    testCaseIds.push(runId);
                }
            });
            if (executionFactory === undefined) {
                throw new Error('Execution factory is required for test execution');
            }
            await this.executionAdapter.runTests(
                this.workspaceUri,
                testCaseIds,
                profileKind,
                runInstance,
                executionFactory,
                debugLauncher,
                interpreter,
                project,
            );
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

        return Promise.resolve();
    }

    public async discoverTests(
        testController: TestController,
        executionFactory: IPythonExecutionFactory,
        token?: CancellationToken,
        interpreter?: PythonEnvironment,
    ): Promise<void> {
        sendTelemetryEvent(EventName.UNITTEST_DISCOVERING, undefined, { tool: this.testProvider });

        // Discovery is expensive. If it is already running, use the existing promise.
        if (this.discovering) {
            traceError('Test discovery already in progress, not starting a new one.');
            return this.discovering.promise;
        }

        const deferred = createDeferred<void>();
        this.discovering = deferred;

        try {
            if (executionFactory === undefined) {
                throw new Error('Execution factory is required for test discovery');
            }
            await this.discoveryAdapter.discoverTests(this.workspaceUri, executionFactory, token, interpreter);
            deferred.resolve();
        } catch (ex) {
            sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_DONE, undefined, { tool: this.testProvider, failed: true });

            let cancel = token?.isCancellationRequested
                ? Testing.cancelUnittestDiscovery
                : Testing.errorUnittestDiscovery;
            if (this.testProvider === 'pytest') {
                cancel = token?.isCancellationRequested ? Testing.cancelPytestDiscovery : Testing.errorPytestDiscovery;
            }

            traceError(`${cancel} for workspace: ${this.workspaceUri} \r\n`, ex);

            // Report also on the test view.
            const message = util.format(`${cancel} ${Testing.seePythonOutput}\r\n`, ex);
            const options = buildErrorNodeOptions(this.workspaceUri, message, this.testProvider);
            const errorNode = createErrorTestItem(testController, options);
            testController.items.add(errorNode);

            return deferred.reject(ex as Error);
        } finally {
            // Discovery has finished running, we have the data,
            // we don't need the deferred promise anymore.
            this.discovering = undefined;
        }

        sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_DONE, undefined, { tool: this.testProvider, failed: false });
        return Promise.resolve();
    }

    /**
     * Retrieves the current test provider instance.
     *
     * @returns {TestProvider} The instance of the test provider.
     */
    public getTestProvider(): TestProvider {
        return this.testProvider;
    }
}
