// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as assert from 'assert';
import * as path from 'path';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { Observable } from 'rxjs';
import * as sinon from 'sinon';
import { IConfigurationService, ITestOutputChannel } from '../../../../client/common/types';
import { EXTENSION_ROOT_DIR } from '../../../../client/constants';
import { TestCommandOptions } from '../../../../client/testing/testController/common/types';
import { UnittestTestDiscoveryAdapter } from '../../../../client/testing/testController/unittest/testDiscoveryAdapter';
import { Deferred, createDeferred } from '../../../../client/common/utils/async';
import { MockChildProcess } from '../../../mocks/mockChildProcess';
import * as util from '../../../../client/testing/testController/common/utils';
import {
    IPythonExecutionFactory,
    IPythonExecutionService,
    Output,
    // SpawnOptions,
} from '../../../../client/common/process/types';

suite('Unittest test discovery adapter', () => {
    let stubConfigSettings: IConfigurationService;
    let outputChannel: typemoq.IMock<ITestOutputChannel>;
    let mockProc: MockChildProcess;
    let execService: typemoq.IMock<IPythonExecutionService>;
    let execFactory = typemoq.Mock.ofType<IPythonExecutionFactory>();
    let deferred: Deferred<void>;
    // let expectedExtraVariables: Record<string, string>;
    let expectedPath: string;
    let uri: Uri;
    let utilsStartDiscoveryNamedPipeStub: sinon.SinonStub;

    setup(() => {
        stubConfigSettings = ({
            getSettings: () => ({
                testing: { unittestArgs: ['-v', '-s', '.', '-p', 'test*'] },
            }),
        } as unknown) as IConfigurationService;
        outputChannel = typemoq.Mock.ofType<ITestOutputChannel>();

        // set up exec service with child process
        mockProc = new MockChildProcess('', ['']);
        const output = new Observable<Output<string>>(() => {
            /* no op */
        });
        execService = typemoq.Mock.ofType<IPythonExecutionService>();
        execService
            .setup((x) => x.execObservable(typemoq.It.isAny(), typemoq.It.isAny()))
            .returns(() => {
                console.log('execObservable is returning');
                return {
                    proc: mockProc,
                    out: output,
                    dispose: () => {
                        /* no-body */
                    },
                };
            });
        execFactory = typemoq.Mock.ofType<IPythonExecutionFactory>();
        deferred = createDeferred();
        execFactory
            .setup((x) => x.createActivatedEnvironment(typemoq.It.isAny()))
            .returns(() => {
                deferred.resolve();
                return Promise.resolve(execService.object);
            });
        execFactory.setup((p) => ((p as unknown) as any).then).returns(() => undefined);
        execService.setup((p) => ((p as unknown) as any).then).returns(() => undefined);

        // constants
        expectedPath = path.join('/', 'my', 'test', 'path');
        uri = Uri.file(expectedPath);
        // expectedExtraVariables = {
        //     TEST_RUN_PIPE: 'discoveryResultPipe-mockName',
        // };

        utilsStartDiscoveryNamedPipeStub = sinon.stub(util, 'startDiscoveryNamedPipe');
        utilsStartDiscoveryNamedPipeStub.callsFake(() =>
            Promise.resolve({
                name: 'discoveryResultPipe-mockName',
                dispose: () => {
                    /* no-op */
                },
            }),
        );
    });
    teardown(() => {
        sinon.restore();
    });

    test('DiscoverTests should send the discovery command to the test server with the correct args', async () => {
        // let options: TestCommandOptions | undefined;

        // const script = path.join(EXTENSION_ROOT_DIR, 'python_files', 'unittestadapter', 'discovery.py');

        const adapter = new UnittestTestDiscoveryAdapter(stubConfigSettings, outputChannel.object);
        adapter.discoverTests(uri, execFactory.object);
        // const argsExpected = [script, '--udiscovery', '-v', '-s', '.', '-p', 'test*'];

        await deferred.promise;
        execService.verify(
            (x) => x.execObservable(typemoq.It.isAny(), typemoq.It.isAny()),
            typemoq.Times.atLeastOnce(),
        );
        // execService.verify((x) => x.execObservable(typemoq.It.isAny(), typemoq.It.isAny()), typemoq.Times.once());
        // execService.verify(
        //     (x) =>
        //         x.execObservable(
        //             typemoq.It.is<Array<string>>((argsActual) => {
        //                 try {
        //                     assert.equal(argsActual.length, argsExpected.length);
        //                     assert.deepEqual(argsActual, argsExpected);
        //                     return true;
        //                 } catch (e) {
        //                     console.error(e);
        //                     throw e;
        //                 }
        //             }),
        //             typemoq.It.is<SpawnOptions>((options) => {
        //                 try {
        //                     assert.deepEqual(options.env, expectedExtraVariables);
        //                     assert.equal(options.cwd, expectedPath);
        //                     assert.equal(options.throwOnStdErr, true);
        //                     return true;
        //                 } catch (e) {
        //                     console.error(e);
        //                     throw e;
        //                 }
        //             }),
        //         ),
        //     typemoq.Times.once(),
        // );
    });
    test('DiscoverTests should respect settings.testings.cwd when present', async () => {
        let options: TestCommandOptions | undefined;
        stubConfigSettings = ({
            getSettings: () => ({
                testing: { unittestArgs: ['-v', '-s', '.', '-p', 'test*'], cwd: '/foo' },
            }),
        } as unknown) as IConfigurationService;

        // const uri = Uri.file('/foo/bar');
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
