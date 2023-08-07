/* eslint-disable @typescript-eslint/no-explicit-any */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as assert from 'assert';
import { Uri } from 'vscode';
import * as typeMoq from 'typemoq';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import { IConfigurationService, ITestOutputChannel } from '../../../../client/common/types';
import { PytestTestDiscoveryAdapter } from '../../../../client/testing/testController/pytest/pytestDiscoveryAdapter';
import { ITestServer } from '../../../../client/testing/testController/common/types';
import {
    IPythonExecutionFactory,
    IPythonExecutionService,
    SpawnOptions,
    Output,
} from '../../../../client/common/process/types';
import { EXTENSION_ROOT_DIR } from '../../../../client/constants';
import { MockChildProcess } from '../../../mocks/mockChildProcess';
import { Deferred, createDeferred } from '../../../../client/common/utils/async';

suite('pytest test discovery adapter', () => {
    let testServer: typeMoq.IMock<ITestServer>;
    let configService: IConfigurationService;
    let execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
    let adapter: PytestTestDiscoveryAdapter;
    let execService: typeMoq.IMock<IPythonExecutionService>;
    let deferred: Deferred<void>;
    let outputChannel: typeMoq.IMock<ITestOutputChannel>;
    let portNum: number;
    let uuid: string;
    let expectedPath: string;
    let uri: Uri;
    let expectedExtraVariables: Record<string, string>;
    let mockProc: MockChildProcess;

    setup(() => {
        const mockExtensionRootDir = typeMoq.Mock.ofType<string>();
        mockExtensionRootDir.setup((m) => m.toString()).returns(() => '/mocked/extension/root/dir');

        // constants
        portNum = 12345;
        uuid = 'uuid123';
        expectedPath = path.join('/', 'my', 'test', 'path');
        uri = Uri.file(expectedPath);
        const relativePathToPytest = 'pythonFiles';
        const fullPluginPath = path.join(EXTENSION_ROOT_DIR, relativePathToPytest);
        expectedExtraVariables = {
            PYTHONPATH: fullPluginPath,
            TEST_UUID: uuid,
            TEST_PORT: portNum.toString(),
        };

        // set up test server
        testServer = typeMoq.Mock.ofType<ITestServer>();
        testServer.setup((t) => t.getPort()).returns(() => portNum);
        testServer.setup((t) => t.createUUID(typeMoq.It.isAny())).returns(() => uuid);
        testServer
            .setup((t) => t.onDiscoveryDataReceived(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => ({
                dispose: () => {
                    /* no-body */
                },
            }));

        // set up config service
        configService = ({
            getSettings: () => ({
                testing: { pytestArgs: ['.'] },
            }),
        } as unknown) as IConfigurationService;

        // set up exec service with child process
        mockProc = new MockChildProcess('', ['']);
        execService = typeMoq.Mock.ofType<IPythonExecutionService>();
        const output = new Observable<Output<string>>(() => {
            /* no op */
        });
        execService
            .setup((x) => x.execObservable(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => ({
                proc: mockProc,
                out: output,
                dispose: () => {
                    /* no-body */
                },
            }));
        execService.setup((p) => ((p as unknown) as any).then).returns(() => undefined);
        outputChannel = typeMoq.Mock.ofType<ITestOutputChannel>();
    });
    test('Discovery should call exec with correct basic args', async () => {
        // set up exec mock
        deferred = createDeferred();
        execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
        execFactory
            .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
            .returns(() => {
                deferred.resolve();
                return Promise.resolve(execService.object);
            });

        adapter = new PytestTestDiscoveryAdapter(testServer.object, configService, outputChannel.object);
        adapter.discoverTests(uri, execFactory.object);
        // add in await and trigger
        await deferred.promise;
        mockProc.trigger('close');

        // verification
        const expectedArgs = ['-m', 'pytest', '-p', 'vscode_pytest', '--collect-only', '.'];
        execService.verify(
            (x) =>
                x.execObservable(
                    expectedArgs,
                    typeMoq.It.is<SpawnOptions>((options) => {
                        assert.deepEqual(options.extraVariables, expectedExtraVariables);
                        assert.equal(options.cwd, expectedPath);
                        assert.equal(options.throwOnStdErr, true);
                        return true;
                    }),
                ),
            typeMoq.Times.once(),
        );
    });
    test('Test discovery correctly pulls pytest args from config service settings', async () => {
        // set up a config service with different pytest args
        const expectedPathNew = path.join('other', 'path');
        const configServiceNew: IConfigurationService = ({
            getSettings: () => ({
                testing: {
                    pytestArgs: ['.', 'abc', 'xyz'],
                    cwd: expectedPathNew,
                },
            }),
        } as unknown) as IConfigurationService;

        // set up exec mock
        deferred = createDeferred();
        execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
        execFactory
            .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
            .returns(() => {
                deferred.resolve();
                return Promise.resolve(execService.object);
            });

        adapter = new PytestTestDiscoveryAdapter(testServer.object, configServiceNew, outputChannel.object);
        adapter.discoverTests(uri, execFactory.object);
        // add in await and trigger
        await deferred.promise;
        mockProc.trigger('close');

        // verification
        const expectedArgs = ['-m', 'pytest', '-p', 'vscode_pytest', '--collect-only', '.', 'abc', 'xyz'];
        execService.verify(
            (x) =>
                x.execObservable(
                    expectedArgs,
                    typeMoq.It.is<SpawnOptions>((options) => {
                        assert.deepEqual(options.extraVariables, expectedExtraVariables);
                        assert.equal(options.cwd, expectedPathNew);
                        assert.equal(options.throwOnStdErr, true);
                        return true;
                    }),
                ),
            typeMoq.Times.once(),
        );
    });
});
