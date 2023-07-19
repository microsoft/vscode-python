// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Uri } from 'vscode';
import { IConfigurationService, ITestOutputChannel } from '../../../common/types';
import { EXTENSION_ROOT_DIR } from '../../../constants';
import {
    DataReceivedEvent,
    DiscoveredTestPayload,
    ITestDiscoveryAdapter,
    ITestResultResolver,
    ITestServer,
    TestCommandOptions,
    TestDiscoveryCommand,
} from '../common/types';

/**
 * Wrapper class for unittest test discovery. This is where we call `runTestCommand`.
 */
export class UnittestTestDiscoveryAdapter implements ITestDiscoveryAdapter {
    constructor(
        public testServer: ITestServer,
        public configSettings: IConfigurationService,
        private readonly outputChannel: ITestOutputChannel,
        private readonly resultResolver?: ITestResultResolver,
    ) {}

    public async discoverTests(uri: Uri): Promise<DiscoveredTestPayload> {
        const settings = this.configSettings.getSettings(uri);
        const { unittestArgs } = settings.testing;
        const cwd = settings.testing.cwd && settings.testing.cwd.length > 0 ? settings.testing.cwd : uri.fsPath;

        const command = buildDiscoveryCommand(unittestArgs);

        const uuid = this.testServer.createUUID(uri.fsPath);

        const options: TestCommandOptions = {
            workspaceFolder: uri,
            command,
            cwd,
            uuid,
            outChannel: this.outputChannel,
        };

        const disposable = this.testServer.onDiscoveryDataReceived((e: DataReceivedEvent) => {
            this.resultResolver?.resolveDiscovery(JSON.parse(e.data));
        });

        await this.callSendCommand(options, () => {
            this.testServer.deleteUUID(uuid);
            disposable.dispose();
        });
        // placeholder until after the rewrite is adopted
        // TODO: remove after adoption.
        const discoveryPayload: DiscoveredTestPayload = {
            cwd,
            status: 'success',
        };
        return discoveryPayload;
    }

    private async callSendCommand(options: TestCommandOptions, callback: () => void): Promise<DiscoveredTestPayload> {
        await this.testServer.sendCommand(options, undefined, undefined, callback);
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
