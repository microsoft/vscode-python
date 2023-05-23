// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Uri } from 'vscode';
import { IConfigurationService, ITestOutputChannel } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import {
    DataReceivedEvent,
    DiscoveredTestPayload,
    ITestDiscoveryAdapter,
    ITestServer,
    TestCommandOptions,
    TestDiscoveryCommand,
} from '../common/types';
import { ITestResultResolver } from '../common/resultResolver';

/**
 * Wrapper class for unittest test discovery. This is where we call `runTestCommand`.
 */
export class UnittestTestDiscoveryAdapter implements ITestDiscoveryAdapter {
    private promiseMap: Map<string, Deferred<DiscoveredTestPayload | undefined>> = new Map();

    private cwd: string | undefined;

    constructor(
        public testServer: ITestServer,
        public configSettings: IConfigurationService,
        private readonly outputChannel: ITestOutputChannel,
        private readonly resultResolver?: ITestResultResolver,
    ) {
        // testServer.onDataReceived(this.onDataReceivedHandler, this);
    }

    // public onDataReceivedHandler({ data }: DataReceivedEvent): void {
    //     this.resultResolver?.resolveDiscovery(JSON.parse(data));
    // }

    public async discoverTests(uri: Uri, isMultiroot?: boolean): Promise<DiscoveredTestPayload> {
        const deferred = createDeferred<DiscoveredTestPayload>();
        const settings = this.configSettings.getSettings(uri);
        const { unittestArgs } = settings.testing;

        const command = buildDiscoveryCommand(unittestArgs);

        this.cwd = uri.fsPath;
        const uuid = this.testServer.createUUID(uri.fsPath);

        const options: TestCommandOptions = {
            workspaceFolder: uri,
            command,
            cwd: this.cwd,
            uuid,
            outChannel: this.outputChannel,
        };

        this.promiseMap.set(uuid, deferred);

        // Send the test command to the server.
        // The server will fire an onDataReceived event once it gets a response.

        const disposable = this.testServer.onDiscoveryDataReceived((e: DataReceivedEvent) => {
            if (isMultiroot !== undefined) {
                this.resultResolver?.resolveDiscovery(JSON.parse(e.data), isMultiroot);
            }
        });
        try {
            await this.callSendCommand(options);
        } finally {
            disposable.dispose();
            // confirm with testing that this gets called (it must clean this up)
        }
        const discoveryPayload: DiscoveredTestPayload = { cwd: uri.fsPath, status: 'success' };
        return discoveryPayload;
    }

    private async callSendCommand(options: TestCommandOptions): Promise<DiscoveredTestPayload> {
        await this.testServer.sendCommand(options);
        const discoveryPayload: DiscoveredTestPayload = { cwd: '', status: 'success' };
        return discoveryPayload;
    }
}

function buildDiscoveryCommand(args: string[]): TestDiscoveryCommand {
    const discoveryScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'unittestadapter', 'discovery.py');

    return {
        script: discoveryScript,
        args: ['--udiscovery', ...args],
    };
}
