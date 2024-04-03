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
import { UnittestTestDiscoveryAdapter } from '../../../../client/testing/testController/unittest/testDiscoveryAdapter';
import { Deferred, createDeferred } from '../../../../client/common/utils/async';
import { MockChildProcess } from '../../../mocks/mockChildProcess';
import * as util from '../../../../client/testing/testController/common/utils';
import {
    IPythonExecutionFactory,
    IPythonExecutionService,
    Output,
    SpawnOptions,
} from '../../../../client/common/process/types';

suite('Unittest test discovery adapter', () => {
    let stubConfigSettings: IConfigurationService;
    let outputChannel: typemoq.IMock<ITestOutputChannel>;
    let mockProc: MockChildProcess;
    let execService: typemoq.IMock<IPythonExecutionService>;
    let execFactory = typemoq.Mock.ofType<IPythonExecutionFactory>();
    let deferred: Deferred<void>;
    let expectedExtraVariables: Record<string, string>;
    let expectedPath: string;
    let uri: Uri;
    let utilsStartDiscoveryNamedPipeStub: sinon.SinonStub;

    setup(() => {
        expectedPath = path.join('/', 'new', 'cwd');
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
                deferred.resolve();
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
            .returns(() => Promise.resolve(execService.object));
        execFactory.setup((p) => ((p as unknown) as any).then).returns(() => undefined);
        execService.setup((p) => ((p as unknown) as any).then).returns(() => undefined);

        // constants
        expectedPath = path.join('/', 'my', 'test', 'path');
        uri = Uri.file(expectedPath);
        expectedExtraVariables = {
            TEST_RUN_PIPE: 'discoveryResultPipe-mockName',
        };

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
        const adapter = new UnittestTestDiscoveryAdapter(stubConfigSettings, outputChannel.object);
        adapter.discoverTests(uri, execFactory.object);
        const script = path.join(EXTENSION_ROOT_DIR, 'python_files', 'unittestadapter', 'discovery.py');
        const argsExpected = [script, '--udiscovery', '-v', '-s', '.', '-p', 'test*'];

        // must await until the execObservable is called in order to verify it
        await deferred.promise;

        execService.verify(
            (x) =>
                x.execObservable(
                    typemoq.It.is<Array<string>>((argsActual) => {
                        try {
                            assert.equal(argsActual.length, argsExpected.length);
                            assert.deepEqual(argsActual, argsExpected);
                            return true;
                        } catch (e) {
                            console.error(e);
                            throw e;
                        }
                    }),
                    typemoq.It.is<SpawnOptions>((options) => {
                        try {
                            assert.deepEqual(options.env, expectedExtraVariables);
                            assert.equal(options.cwd, expectedPath);
                            assert.equal(options.throwOnStdErr, true);
                            return true;
                        } catch (e) {
                            console.error(e);
                            throw e;
                        }
                    }),
                ),
            typemoq.Times.once(),
        );
    });
    test('DiscoverTests should respect settings.testings.cwd when present', async () => {
        const expectedNewPath = path.join('/', 'new', 'cwd');
        stubConfigSettings = ({
            getSettings: () => ({
                testing: { unittestArgs: ['-v', '-s', '.', '-p', 'test*'], cwd: expectedNewPath.toString() },
            }),
        } as unknown) as IConfigurationService;
        const adapter = new UnittestTestDiscoveryAdapter(stubConfigSettings, outputChannel.object);
        adapter.discoverTests(uri, execFactory.object);
        const script = path.join(EXTENSION_ROOT_DIR, 'python_files', 'unittestadapter', 'discovery.py');
        const argsExpected = [script, '--udiscovery', '-v', '-s', '.', '-p', 'test*'];

        // must await until the execObservable is called in order to verify it
        await deferred.promise;

        execService.verify(
            (x) =>
                x.execObservable(
                    typemoq.It.is<Array<string>>((argsActual) => {
                        try {
                            assert.equal(argsActual.length, argsExpected.length);
                            assert.deepEqual(argsActual, argsExpected);
                            return true;
                        } catch (e) {
                            console.error(e);
                            throw e;
                        }
                    }),
                    typemoq.It.is<SpawnOptions>((options) => {
                        try {
                            assert.deepEqual(options.env, expectedExtraVariables);
                            assert.equal(options.cwd, expectedNewPath);
                            assert.equal(options.throwOnStdErr, true);
                            return true;
                        } catch (e) {
                            console.error(e);
                            throw e;
                        }
                    }),
                ),
            typemoq.Times.once(),
        );
    });
});
