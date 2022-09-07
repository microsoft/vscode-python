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
 * Wrapper class for unittest test discovery. This is where we call `runTestCommand`. #this seems incorrectly copied
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
            const settings = this.configSettings.getSettings(uri);
            const { pytestArgs } = settings.testing;
            console.debug(pytestArgs);
            // const command2 = buildDiscoveryCommand('-m pytest', ['--collect-only', ...pytestArgs]);
            // const command = buildDiscoveryCommand('import pytest', []);

            this.cwd = uri.fsPath; // this.cwd normally = '/Users/eleanorboyd/Documents/testing - tester files/inc_dec_example'
            // const discoveryScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'unittest_adapter', 'unittest_discovery.py');

            const relativePathToPytest = 'pythonFiles/pytest-vscode-integration';
            const fpath = path.join(EXTENSION_ROOT_DIR, relativePathToPytest);
            // console.debug('1.2: ', fpath);
            //const cc = 'sys.path.append('.concat(fpath.toString(), ')'); // 1.2:  /Users/eleanorboyd/vscode-python/pythonFiles/pytest-vscode-integration
            // console.debug('1.3: ', cc);
            let command: TestDiscoveryCommand = buildDiscoveryCommand('-m pytest --collect-only', []); // as a collection
            const options3: TestCommandOptions = {
                workspaceFolder: uri,
                'python -m pytest --collect-only -p: ', // with the port, these args for plugin
                cwd: fpath,
                env: {"PYTHONPATH": fpath},
            };
            this.testServer.sendCommand(options3);

            this.deferred = createDeferred<DiscoveredTestPayload>();
            const prom = this.deferred.promise;
            const a = await prom;
            console.debug('AAAA', a);

            // // Send the test command to the server.
            // // The server will fire an onDataReceived event once it gets a response.
            // this.testServer.sendCommand(options2);
            command = buildDiscoveryCommand('import pytest', []);
            const options4: TestCommandOptions = {
                workspaceFolder: uri,
                command,
                cwd: fpath,
            };
            this.testServer.sendCommand(options4);
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
