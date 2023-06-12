// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { IConfigurationService, ITestOutputChannel } from '../../../../client/common/types';
import { EXTENSION_ROOT_DIR } from '../../../../client/constants';
import { ITestServer, TestCommandOptions } from '../../../../client/testing/testController/common/types';
import { UnittestTestDiscoveryAdapter } from '../../../../client/testing/testController/unittest/testDiscoveryAdapter';

suite('Unittest test discovery adapter', () => {
    let stubConfigSettings: IConfigurationService;
    let outputChannel: typemoq.IMock<ITestOutputChannel>;

    setup(() => {
        stubConfigSettings = ({
            getSettings: () => ({
                testing: { unittestArgs: ['-v', '-s', '.', '-p', 'test*'] },
            }),
        } as unknown) as IConfigurationService;
        outputChannel = typemoq.Mock.ofType<ITestOutputChannel>();
    });

    test('DiscoverTests should send the discovery command to the test server with the correct args', async () => {
        let options: TestCommandOptions | undefined;

        const stubTestServer = ({
            sendCommand(opt: TestCommandOptions): Promise<void> {
                delete opt.outChannel;
                options = opt;
                return Promise.resolve();
            },
            onDiscoveryDataReceived: () => {
                // no body
            },
            createUUID: () => '123456789',
        } as unknown) as ITestServer;

        const uri = Uri.file('/foo/bar');
        const script = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'unittestadapter', 'discovery.py');

        const adapter = new UnittestTestDiscoveryAdapter(stubTestServer, stubConfigSettings, outputChannel.object);
        adapter.discoverTests(uri);

        assert.deepStrictEqual(options, {
            workspaceFolder: uri,
            cwd: uri.fsPath,
            command: {
                script,
                args: ['--udiscovery', '-v', '-s', '.', '-p', 'test*'],
            },
            uuid: '123456789',
        });
    });
});
