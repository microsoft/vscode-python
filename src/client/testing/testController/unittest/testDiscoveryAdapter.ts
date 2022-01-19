// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Uri } from 'vscode';
// import { IPythonExecutionFactory } from '../../../common/process/types';
import { IConfigurationService } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import { TestDiscoveryOptions } from '../../common/types';
// import { runTestCommand } from '../common/commandRunner';
import { DataReceivedEvent, DiscoveredTestPayload, ITestDiscoveryAdapter, ITestServer } from '../common/types';

/**
 * Wrapper class for unittest test discovery. This is where we call `runTestCommand`.
 */
export class UnittestTestDiscoveryAdapter implements ITestDiscoveryAdapter {
    private deferred: Deferred<DiscoveredTestPayload> | undefined;

    private cwd: string | undefined;

    constructor(
        public testServer: ITestServer,
        // public executionFactory: IPythonExecutionFactory,
        public configSettings: IConfigurationService, // public port: number,
    ) {
        testServer.onDataReceived(this.onDataReceivedHandler);
    }

    public onDataReceivedHandler({ cwd, data }: DataReceivedEvent): void {
        if (this.deferred && cwd === this.cwd) {
            const testData: DiscoveredTestPayload = JSON.parse(data);

            this.deferred.resolve(testData);
            this.deferred = undefined;
        }
    }

    public async discoverTests(uri: Uri): Promise<DiscoveredTestPayload> {
        if (!this.deferred) {
            const settings = this.configSettings.getSettings(uri);
            const { unittestArgs } = settings.testing;

            const command = this.buildDiscoveryCommand(unittestArgs);

            this.cwd = uri.fsPath;

            const options: TestDiscoveryOptions = {
                workspaceFolder: uri,
                // port: this.port,
                args: command,
                cwd: this.cwd,
                ignoreCache: false,
            };

            this.deferred = createDeferred<DiscoveredTestPayload>();

            // Send the test command to the server.
            // The server will fire an onDataReceived event once it gets a response.
            this.testServer.sendCommand(options);
        }

        return this.deferred.promise;
        // const result = await runTestCommand(this.executionFactory, options);
        // const testData = JSON.parse(result);

        // return Promise.resolve(testData);
    }

    private buildDiscoveryCommand(args: string[]): string[] {
        const discoveryScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'unittestadapter', 'discovery.py');
        return [discoveryScript, '--port', `${this.testServer.port}`, '--udiscovery', ...args];
    }
}
