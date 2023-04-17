// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Uri } from 'vscode';
import { IConfigurationService } from '../../../common/types';
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

/**
 * Wrapper Class for unittest test execution. This is where we call `runTestCommand`?
 */

export class UnittestTestExecutionAdapter implements ITestExecutionAdapter {
    private promiseMap: Map<string, Deferred<ExecutionTestPayload | undefined>> = new Map();

    private cwd: string | undefined;

    constructor(public testServer: ITestServer, public configSettings: IConfigurationService) {
        testServer.onDataReceived(this.onDataReceivedHandler, this);
    }

    public onDataReceivedHandler({ uuid, data }: DataReceivedEvent): void {
        const deferred = this.promiseMap.get(uuid);
        if (deferred) {
            deferred.resolve(JSON.parse(data));
            this.promiseMap.delete(uuid);
        }
    }

    public async runTests(uri: Uri, testIds: string[], debugBool?: boolean): Promise<ExecutionTestPayload> {
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
