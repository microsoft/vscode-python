// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { TestRun, Uri } from 'vscode';
import { IConfigurationService, ITestOutputChannel } from '../../../common/types';
import { Deferred, createDeferred } from '../../../common/utils/async';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import {
    DataReceivedEvent,
    ExecutionTestPayload,
    ITestExecutionAdapter,
    ITestResultResolver,
    ITestServer,
    TestCommandOptions,
    TestExecutionCommand,
} from '../common/types';
import { traceError, traceInfo, traceLog } from '../../../logging';
import { startTestIdServer } from '../common/utils';

/**
 * Wrapper Class for unittest test execution. This is where we call `runTestCommand`?
 */

export class UnittestTestExecutionAdapter implements ITestExecutionAdapter {
    constructor(
        public testServer: ITestServer,
        public configSettings: IConfigurationService,
        private readonly outputChannel: ITestOutputChannel,
        private readonly resultResolver?: ITestResultResolver,
    ) {}

    public async runTests(
        uri: Uri,
        testIds: string[],
        debugBool?: boolean,
        runInstance?: TestRun,
    ): Promise<ExecutionTestPayload> {
        const uuid = this.testServer.createUUID(uri.fsPath);
        const deferredTillEOT: Deferred<void> = createDeferred<void>();
        const disposedDataReceived = this.testServer.onRunDataReceived((e: DataReceivedEvent) => {
            if (runInstance) {
                this.resultResolver?.resolveExecution(JSON.parse(e.data), runInstance, deferredTillEOT);
            } else {
                traceError('No run instance found, cannot resolve execution.');
            }
        });
        const disposeDataReceiver = function (testServer: ITestServer) {
            traceInfo(`Disposing data receiver for ${uri.fsPath} and deleting UUID; unittest execution.`);
            testServer.deleteUUID(uuid);
            disposedDataReceived.dispose();
        };
        runInstance?.token.onCancellationRequested(() => {
            traceInfo("Test run cancelled, resolving 'till EOT' deferred.");
            deferredTillEOT.resolve();
        });
        try {
            await this.runTestsNew(uri, testIds, uuid, runInstance, debugBool, deferredTillEOT);
            await deferredTillEOT.promise;
            disposeDataReceiver(this.testServer);
        } catch (error) {
            traceError(`Error in running unittest tests: ${error}`);
        }
        const executionPayload: ExecutionTestPayload = { cwd: uri.fsPath, status: 'success', error: '' };
        return executionPayload;
    }

    private async runTestsNew(
        uri: Uri,
        testIds: string[],
        uuid: string,
        runInstance?: TestRun,
        debugBool?: boolean,
        deferredTillEOT?: Deferred<void>,
    ): Promise<ExecutionTestPayload> {
        const settings = this.configSettings.getSettings(uri);
        const { unittestArgs } = settings.testing;
        const cwd = settings.testing.cwd && settings.testing.cwd.length > 0 ? settings.testing.cwd : uri.fsPath;

        const command = buildExecutionCommand(unittestArgs);

        const options: TestCommandOptions = {
            workspaceFolder: uri,
            command,
            cwd,
            uuid,
            debugBool,
            testIds,
            outChannel: this.outputChannel,
        };
        traceLog(`Running UNITTEST execution for the following test ids: ${testIds}`);

        const runTestIdsPort = await startTestIdServer(testIds);

        await this.testServer.sendCommand(options, runTestIdsPort.toString(), runInstance, testIds, () => {
            deferredTillEOT?.resolve();
        });
        // placeholder until after the rewrite is adopted
        // TODO: remove after adoption.
        const executionPayload: ExecutionTestPayload = { cwd, status: 'success', error: '' };
        return executionPayload;
    }
}

function buildExecutionCommand(args: string[]): TestExecutionCommand {
    const executionScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'unittestadapter', 'execution.py');

    return {
        script: executionScript,
        args: ['--udiscovery', ...args],
    };
}
