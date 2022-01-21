// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import { Uri } from 'vscode';
import { IConfigurationService } from '../../../../client/common/types';
import { EXTENSION_ROOT_DIR } from '../../../../client/constants';
import { ITestServer, TestCommandOptions } from '../../../../client/testing/testController/common/types';
import { UnittestTestDiscoveryAdapter } from '../../../../client/testing/testController/unittest/testDiscoveryAdapter';

suite('Unittest test discovery adapter', () => {
    let stubConfigSettings: IConfigurationService;

    setup(() => {
        stubConfigSettings = ({
            getSettings: () => ({
                testing: { unittestArgs: ['-v', '-s', '.', '-p', 'test*'] },
            }),
        } as unknown) as IConfigurationService;
    });

    test('discoverTests should send the discovery command to the test server', async () => {
        let options: TestCommandOptions | undefined;

        const stubTestServer = ({
            sendCommand(opt: TestCommandOptions): Promise<void> {
                options = opt;
                return Promise.resolve();
            },
            onDataReceived: () => {
                // no body
            },
        } as unknown) as ITestServer;

        const uri = Uri.file('/foo/bar');
        const script = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'unittestadapter', 'discovery.py');

        const adapter = new UnittestTestDiscoveryAdapter(stubTestServer, stubConfigSettings);
        adapter.discoverTests(uri);

        assert.deepStrictEqual(options, {
            workspaceFolder: uri,
            cwd: uri.fsPath,
            command: { script, args: ['--udiscovery', '-v', '-s', '.', '-p', 'test*'] },
        });
    });

    test("onDataReceivedHandler should parse the data if the cwd from the payload matches the test adapter's cwd", async () => {
        const stubTestServer = ({
            sendCommand(): Promise<void> {
                return Promise.resolve();
            },
            onDataReceived: () => {
                // no body
            },
        } as unknown) as ITestServer;

        const uri = Uri.file('/foo/bar');
        const data = { status: 'success' };

        const adapter = new UnittestTestDiscoveryAdapter(stubTestServer, stubConfigSettings);
        const promise = adapter.discoverTests(uri);

        adapter.onDataReceivedHandler({ cwd: uri.fsPath, data: JSON.stringify(data) });

        const result = await promise;

        assert.deepStrictEqual(result, data);
    });

    test("onDataReceivedHandler should ignore the data if the cwd from the payload does not match the test adapter's cwd", async () => {
        const stubTestServer = ({
            sendCommand(): Promise<void> {
                return Promise.resolve();
            },
            onDataReceived: () => {
                // no body
            },
        } as unknown) as ITestServer;

        const uri = Uri.file('/foo/bar');

        const adapter = new UnittestTestDiscoveryAdapter(stubTestServer, stubConfigSettings);
        const promise = adapter.discoverTests(uri);

        const data = { status: 'success' };
        adapter.onDataReceivedHandler({ cwd: 'some/other/path', data: JSON.stringify(data) });

        const nextData = { status: 'error' };
        adapter.onDataReceivedHandler({ cwd: uri.fsPath, data: JSON.stringify(nextData) });

        const result = await promise;

        assert.deepStrictEqual(result, nextData);
    });
});
