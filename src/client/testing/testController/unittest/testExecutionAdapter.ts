// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { TestRun, Uri } from 'vscode';
import { IConfigurationService, ITestOutputChannel } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import {
    DataReceivedEvent,
    ExecutionTestPayload,
    ITestExecutionAdapter,
    ITestServer,
    TestCommandOptions,
    TestExecutionCommand,
} from '../common/types';
import { ITestResultResolver } from '../common/resultResolver';

/**
 * Wrapper Class for unittest test execution. This is where we call `runTestCommand`?
 */

export class UnittestTestExecutionAdapter implements ITestExecutionAdapter {
    private promiseMap: Map<string, Deferred<ExecutionTestPayload | undefined>> = new Map();

    private cwd: string | undefined;

    private runInstance!: TestRun;

    constructor(
        public testServer: ITestServer,
        public configSettings: IConfigurationService,
        private readonly outputChannel: ITestOutputChannel,
        private readonly resultResolver?: ITestResultResolver,
    ) {
        testServer.onDataReceived(this.onDataReceivedHandler, this);
    }

    public onDataReceivedHandler({ data }: DataReceivedEvent): void {
        this.resultResolver?.resolveRun(JSON.parse(data), this.runInstance);
    }

    public async runTests(
        uri: Uri,
        testIds: string[],
        debugBool?: boolean,
        runInstance?: TestRun,
    ): Promise<ExecutionTestPayload> {
        this.runInstance = runInstance!;
        const settings = this.configSettings.getSettings(uri);
        const { unittestArgs } = settings.testing;

        const command = buildExecutionCommand(unittestArgs);
        this.cwd = uri.fsPath;
        const uuid = this.testServer.createUUID(uri.fsPath);

        const options: TestCommandOptions = {
            workspaceFolder: uri,
            command,
            cwd: this.cwd,
            uuid,
            debugBool,
            testIds,
            outChannel: this.outputChannel,
        };

        const deferred = createDeferred<ExecutionTestPayload>();
        this.promiseMap.set(uuid, deferred);

        // Send test command to server.
        // Server fire onDataReceived event once it gets response.
        this.testServer.sendCommand(options);

        return deferred.promise;
    }
}

function buildExecutionCommand(args: string[]): TestExecutionCommand {
    const executionScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'unittestadapter', 'execution.py');

    return {
        script: executionScript,
        args: ['--udiscovery', ...args],
    };
}
