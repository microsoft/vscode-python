// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Uri } from 'vscode';
import { IConfigurationService } from '../../../common/types';
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

/**
 * Wrapper class for unittest test discovery. This is where we call `runTestCommand`.
 */
export class UnittestTestDiscoveryAdapter implements ITestDiscoveryAdapter {
    private promiseMap: Map<string, Deferred<DiscoveredTestPayload | undefined>> = new Map();

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

    public async discoverTests(uri: Uri): Promise<DiscoveredTestPayload> {
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
        };

        this.promiseMap.set(uuid, deferred);

        // Send the test command to the server.
        // The server will fire an onDataReceived event once it gets a response.
        this.testServer.sendCommand(options);

        return deferred.promise;
    }
}

function buildDiscoveryCommand(args: string[]): TestDiscoveryCommand {
    const discoveryScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'unittestadapter', 'discovery.py');

    return {
        script: discoveryScript,
        args: ['--udiscovery', ...args],
    };
}
