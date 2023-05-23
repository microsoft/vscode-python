// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as util from 'util';
import { CancellationToken, TestController, TestItem, TestRun, Uri } from 'vscode';
import path from 'path';
import { createDeferred, Deferred } from '../../common/utils/async';
import { Testing } from '../../common/utils/localize';
import { traceError, traceVerbose } from '../../logging';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { TestProvider } from '../types';
import { ErrorTestItemOptions, createErrorTestItem, getTestCaseNodes } from './common/testItemUtilities';
import { ITestDiscoveryAdapter, ITestExecutionAdapter } from './common/types';
import { IPythonExecutionFactory } from '../../common/process/types';

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
                await this.executionAdapter.runTests(
                    this.workspaceUri,
                    testCaseIds,
                    debugBool,
                    runInstance,
                    executionFactory,
                );
                traceVerbose('executionFactory defined');
            } else {
                await this.executionAdapter.runTests(this.workspaceUri, testCaseIds, debugBool);
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
        console.log('dfsad', isMultiroot, workspaceFilePath);
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

export function buildErrorNodeOptions(uri: Uri, message: string, testType: string): ErrorTestItemOptions {
    const labelText = testType === 'pytest' ? 'Pytest Discovery Error' : 'Unittest Discovery Error';
    return {
        id: `DiscoveryError:${uri.fsPath}`,
        label: `${labelText} [${path.basename(uri.fsPath)}]`,
        error: message,
    };
}
