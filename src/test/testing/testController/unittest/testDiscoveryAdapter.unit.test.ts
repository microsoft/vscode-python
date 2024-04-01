// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { Observable } from 'rxjs';
import { IConfigurationService, ITestOutputChannel } from '../../../../client/common/types';
import { EXTENSION_ROOT_DIR } from '../../../../client/constants';
import { TestCommandOptions } from '../../../../client/testing/testController/common/types';
import { UnittestTestDiscoveryAdapter } from '../../../../client/testing/testController/unittest/testDiscoveryAdapter';
import { createDeferred } from '../../../../client/common/utils/async';
import { MockChildProcess } from '../../../mocks/mockChildProcess';
import { IPythonExecutionFactory, IPythonExecutionService, Output } from '../../../../client/common/process/types';

suite('Unittest test discovery adapter', () => {
    let stubConfigSettings: IConfigurationService;
    let outputChannel: typemoq.IMock<ITestOutputChannel>;
    let mockProc: MockChildProcess;
    let execService: typemoq.IMock<IPythonExecutionService>;
    let execFactory = typemoq.Mock.ofType<IPythonExecutionFactory>();

    setup(() => {
        stubConfigSettings = ({
            getSettings: () => ({
                testing: { unittestArgs: ['-v', '-s', '.', '-p', 'test*'] },
            }),
        } as unknown) as IConfigurationService;
        // outputChannel = typemoq.Mock.ofType<ITestOutputChannel>();

        // set up exec service with child process
        mockProc = new MockChildProcess('', ['']);
        execService = typemoq.Mock.ofType<IPythonExecutionService>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        outputChannel = typemoq.Mock.ofType<ITestOutputChannel>();

        const output = new Observable<Output<string>>(() => {
            /* no op */
        });
        execService
            .setup((x) => x.execObservable(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => ({
                proc: mockProc,
                out: output,
                dispose: () => {
                    /* no-body */
                },
            }));
        execFactory = typemoq.Mock.ofType<IPythonExecutionFactory>();
        execFactory
            .setup((x) => x.createActivatedEnvironment(typemoq.It.isAny()))
            .returns(() => Promise.resolve(execService.object));
    });

    test('DiscoverTests should send the discovery command to the test server with the correct args', async () => {
        let options: TestCommandOptions | undefined;

        const deferred = createDeferred();

        const uri = Uri.file('/foo/bar');
        const script = path.join(EXTENSION_ROOT_DIR, 'python_files', 'unittestadapter', 'discovery.py');

        const adapter = new UnittestTestDiscoveryAdapter(stubConfigSettings, outputChannel.object);
        adapter.discoverTests(uri, execFactory.object);

        await deferred.promise;
        assert.deepStrictEqual(options?.command?.args, ['--udiscovery', '-v', '-s', '.', '-p', 'test*']);
        assert.deepStrictEqual(options.workspaceFolder, uri);
        assert.deepStrictEqual(options.cwd, uri.fsPath);
        assert.deepStrictEqual(options.command.script, script);
    });
    test('DiscoverTests should respect settings.testings.cwd when present', async () => {
        let options: TestCommandOptions | undefined;
        stubConfigSettings = ({
            getSettings: () => ({
                testing: { unittestArgs: ['-v', '-s', '.', '-p', 'test*'], cwd: '/foo' },
            }),
        } as unknown) as IConfigurationService;

        const deferred = createDeferred();

        const uri = Uri.file('/foo/bar');
        const newCwd = '/foo';
        const script = path.join(EXTENSION_ROOT_DIR, 'python_files', 'unittestadapter', 'discovery.py');

        const adapter = new UnittestTestDiscoveryAdapter(stubConfigSettings, outputChannel.object);
        adapter.discoverTests(uri, execFactory.object);
        await deferred.promise;
        assert.deepStrictEqual(options?.command?.args, ['--udiscovery', '-v', '-s', '.', '-p', 'test*']);
        assert.deepStrictEqual(options.workspaceFolder, uri);
        assert.deepStrictEqual(options.cwd, newCwd);
        assert.deepStrictEqual(options.command.script, script);
    });
});
