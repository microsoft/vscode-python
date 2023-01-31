// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { IConfigurationService } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import {
    DataReceivedEvent,
    ExecutionTestPayload,
    ITestExecutionAdapter,
    ITestServer,
    TestCommandOptions,
    TestExecutionCommand,
} from '../common/types';

/**
 * Wrapper Class for pytest test execution. This is where we call `runTestCommand`?
 */

export class PytestTestExecutionAdapter implements ITestExecutionAdapter {
    private deferred: Deferred<ExecutionTestPayload> | undefined;

    private cwd: string | undefined;

    constructor(public testServer: ITestServer, public configSettings: IConfigurationService) {
        testServer.onDataReceived(this.onDataReceivedHandler, this);
    }

    public onDataReceivedHandler({ cwd, data }: DataReceivedEvent): void {
        if (this.deferred && cwd === this.cwd) {
            const testData: ExecutionTestPayload = JSON.parse(data);

            this.deferred.resolve(testData);
            this.deferred = undefined;
        }
    }

    public async runTests(uri: Uri, testIds: string[], debugBool?: boolean): Promise<ExecutionTestPayload> {
        if (!this.deferred) {
            const settings = this.configSettings.getSettings(uri);
            const { pytestArgs } = settings.testing;

            const command = buildExecutionCommand(pytestArgs);
            this.cwd = uri.fsPath;

            const options: TestCommandOptions = {
                workspaceFolder: uri,
                command,
                cwd: this.cwd,
                debugBool,
                testIds,
            };

            this.deferred = createDeferred<ExecutionTestPayload>();

            // send test command to server
            // server fire onDataReceived event once it gets response
            this.testServer.sendCommand(options);
        }
        return this.deferred.promise;
    }
}

function buildExecutionCommand(args: string[]): TestExecutionCommand {
    const executionScript = '';

    return {
        script: executionScript,
        args: ['--udiscovery', ...args],
    };
}