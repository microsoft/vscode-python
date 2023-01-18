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
 * Wrapper class for pytest test discovery. This is where we call `discovery`.
 */
export class PytestTestDiscoveryAdapter implements ITestDiscoveryAdapter {
    private deferred: Deferred<DiscoveredTestPayload> | undefined;

    private cwd: string | undefined;

    constructor(public testServer: ITestServer, public configSettings: IConfigurationService) {
        testServer.onDataReceived(this.onDataReceivedHandler, this);
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
            this.cwd = uri.fsPath;
            const relativePathToPytest = 'pythonFiles/pytest-vscode-integration';
            const fpath = path.join(EXTENSION_ROOT_DIR, relativePathToPytest);

            // send path for pytest plugin
            const pytestPluginPath = 'sys.path.append('.concat(fpath.toString(), ')');
            let command: TestDiscoveryCommand = buildDiscoveryCommand(pytestPluginPath, []);
            const options: TestCommandOptions = {
                workspaceFolder: uri,
                command,
                cwd: fpath,
            };
            this.testServer.sendCommand(options);

            this.deferred = createDeferred<DiscoveredTestPayload>();

            // importing pytest
            command = buildDiscoveryCommand('import pytest', []);

            this.testServer.sendCommand(options);
        }

        return this.deferred.promise;
    }
}

function buildDiscoveryCommand(script: string, args: string[]): TestDiscoveryCommand {
    const discoveryScript = script;

    return {
        script: discoveryScript,
        args: [...args],
    };
}
