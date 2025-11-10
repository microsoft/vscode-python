// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TestRun, Uri } from 'vscode';
import { ChildProcess } from 'child_process';
import { Deferred, createDeferred } from '../../../common/utils/async';
import { traceError, traceVerbose } from '../../../logging';
import { ExecutionTestPayload } from '../common/types';
import * as utils from '../common/utils';
import * as fs from 'fs';

/**
 * Encapsulates all state and resources for a single pytest subprocess instance.
 * This class groups together all the items that need to be created and managed
 * per subprocess when running tests in parallel.
 *
 * Each instance manages:
 * - A deferred promise for the test execution result
 * - The child process running the tests
 * - A cancellation token for handling test run cancellation
 * - Test IDs file for this subprocess
 * - References to shared resources (test run, workspace URI, result pipe)
 */
export class PytestSubprocessInstance {
    /**
     * Deferred promise that resolves when test execution completes
     */
    public deferred: Deferred<ExecutionTestPayload>;

    /**
     * Token to track if this test run has been cancelled
     */
    public cancellationToken?: { cancelled: boolean };

    /**
     * The child process running the pytest execution
     */
    public process?: ChildProcess;

    /**
     * Path to the temporary file containing test IDs for this subprocess
     */
    public testIdsFileName?: string;

    constructor(
        public readonly testRun: TestRun,
        public readonly debugBool: boolean,
        public readonly workspaceUri: Uri,
        public readonly resultPipeName: string,
        public readonly testIds: string[],
    ) {
        this.deferred = createDeferred<ExecutionTestPayload>();
    }

    /**
     * Initializes the subprocess instance by creating the test IDs file.
     * Must be called after construction before using the instance.
     */
    public async initialize(): Promise<void> {
        this.testIdsFileName = await utils.writeTestIdsFile(this.testIds);
    }

    /**
     * Handles data received events for this subprocess instance.
     * Currently not used in the new architecture but kept for future extensibility.
     */
    public handleDataReceivedEvent(data: ExecutionTestPayload): void {
        if (this.cancellationToken?.cancelled) {
            traceVerbose('Test run cancelled, skipping data processing');
            return;
        }

        if (data.status === 'success' || data.status === 'error') {
            this.deferred.resolve(data);
        } else {
            traceError(`Unknown status for data received event: ${data.status}`);
        }
    }

    /**
     * Sets the child process for this instance.
     */
    public setProcess(process: ChildProcess): void {
        this.process = process;
    }

    /**
     * Sets the cancellation token for this instance.
     */
    public setCancellationToken(token: { cancelled: boolean }): void {
        this.cancellationToken = token;
    }

    /**
     * Checks if this subprocess has been cancelled.
     */
    public isCancelled(): boolean {
        return this.cancellationToken?.cancelled ?? false;
    }

    /**
     * Disposes of resources associated with this subprocess instance.
     * Kills the child process if it's still running and cleans up the test IDs file.
     */
    public dispose(): void {
        if (this.process) {
            try {
                this.process.kill();
            } catch (error) {
                traceError(`Error killing subprocess: ${error}`);
            }
        }

        // Clean up test IDs file
        if (this.testIdsFileName) {
            try {
                fs.unlinkSync(this.testIdsFileName);
            } catch (error) {
                traceError(`Error deleting test IDs file: ${error}`);
            }
        }
    }

    /**
     * Returns the promise that will resolve when execution completes.
     */
    public getExecutionPromise(): Promise<ExecutionTestPayload> {
        return this.deferred.promise;
    }
}
