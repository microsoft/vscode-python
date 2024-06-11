/* eslint-disable @typescript-eslint/no-explicit-any */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as assert from 'assert';
import { Uri } from 'vscode';
import * as typeMoq from 'typemoq';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import * as fs from 'fs';
import * as sinon from 'sinon';
import { IConfigurationService, ITestOutputChannel } from '../../../../client/common/types';
import { PytestTestDiscoveryAdapter } from '../../../../client/testing/testController/pytest/pytestDiscoveryAdapter';
import {
    IPythonExecutionFactory,
    IPythonExecutionService,
    SpawnOptions,
    Output,
} from '../../../../client/common/process/types';
import { EXTENSION_ROOT_DIR } from '../../../../client/constants';
import { MockChildProcess } from '../../../mocks/mockChildProcess';
import { Deferred, createDeferred } from '../../../../client/common/utils/async';
import * as util from '../../../../client/testing/testController/common/utils';

suite('pytest test discovery adapter', () => {
    let configService: IConfigurationService;
    let execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
    let adapter: PytestTestDiscoveryAdapter;
    let execService: typeMoq.IMock<IPythonExecutionService>;
    let deferred: Deferred<void>;
    let outputChannel: typeMoq.IMock<ITestOutputChannel>;
    let expectedPath: string;
    let uri: Uri;
    let expectedExtraVariables: Record<string, string>;
    let mockProc: MockChildProcess;
    let deferred2: Deferred<void>;
    let utilsStartDiscoveryNamedPipeStub: sinon.SinonStub;

    setup(() => {
        const mockExtensionRootDir = typeMoq.Mock.ofType<string>();
        mockExtensionRootDir.setup((m) => m.toString()).returns(() => '/mocked/extension/root/dir');

        utilsStartDiscoveryNamedPipeStub = sinon.stub(util, 'startDiscoveryNamedPipe');
        utilsStartDiscoveryNamedPipeStub.callsFake(() =>
            Promise.resolve({
                name: 'discoveryResultPipe-mockName',
                dispose: () => {
                    /* no-op */
                },
            }),
        );

        // constants
        expectedPath = path.join('/', 'my', 'test', 'path');
        uri = Uri.file(expectedPath);
        const relativePathToPytest = 'python_files';
        const fullPluginPath = path.join(EXTENSION_ROOT_DIR, relativePathToPytest);
        expectedExtraVariables = {
            PYTHONPATH: fullPluginPath,
            TEST_RUN_PIPE: 'discoveryResultPipe-mockName',
        };

        // set up config service
        configService = ({
            getSettings: () => ({
                testing: { pytestArgs: ['.'] },
            }),
        } as unknown) as IConfigurationService;

        // set up exec service with child process
        mockProc = new MockChildProcess('', ['']);
        execService = typeMoq.Mock.ofType<IPythonExecutionService>();
        execService.setup((p) => ((p as unknown) as any).then).returns(() => undefined);
        outputChannel = typeMoq.Mock.ofType<ITestOutputChannel>();

        const output = new Observable<Output<string>>(() => {
            /* no op */
        });
        deferred2 = createDeferred();
        execService
            .setup((x) => x.execObservable(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => {
                deferred2.resolve();
                return {
                    proc: mockProc,
                    out: output,
                    dispose: () => {
                        /* no-body */
                    },
                };
            });
    });
    teardown(() => {
        sinon.restore();
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

        sinon.stub(fs.promises, 'lstat').callsFake(
            async () =>
                ({
                    isFile: () => true,
                    isSymbolicLink: () => false,
                } as fs.Stats),
        );
        sinon.stub(fs.promises, 'realpath').callsFake(async (pathEntered) => pathEntered.toString());

        adapter = new PytestTestDiscoveryAdapter(configService, outputChannel.object);
        adapter.discoverTests(uri, execFactory.object);
        // add in await and trigger
        await deferred.promise;
        await deferred2.promise;
        mockProc.trigger('close');

        // verification
        execService.verify(
            (x) =>
                x.execObservable(
                    typeMoq.It.isAny(),
                    typeMoq.It.is<SpawnOptions>((options) => {
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

        sinon.stub(fs.promises, 'lstat').callsFake(
            async () =>
                ({
                    isFile: () => true,
                    isSymbolicLink: () => false,
                } as fs.Stats),
        );
        sinon.stub(fs.promises, 'realpath').callsFake(async (pathEntered) => pathEntered.toString());

        // set up exec mock
        deferred = createDeferred();
        execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
        execFactory
            .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
            .returns(() => {
                deferred.resolve();
                return Promise.resolve(execService.object);
            });

        adapter = new PytestTestDiscoveryAdapter(configServiceNew, outputChannel.object);
        adapter.discoverTests(uri, execFactory.object);
        // add in await and trigger
        await deferred.promise;
        await deferred2.promise;
        mockProc.trigger('close');

        // verification

        const expectedArgs = ['-m', 'pytest', '-p', 'vscode_pytest', '--collect-only', '.', 'abc', 'xyz'];
        execService.verify(
            (x) =>
                x.execObservable(
                    expectedArgs,
                    typeMoq.It.is<SpawnOptions>((options) => {
                        assert.deepEqual(options.env, expectedExtraVariables);
                        assert.equal(options.cwd, expectedPathNew);
                        assert.equal(options.throwOnStdErr, true);
                        return true;
                    }),
                ),
            typeMoq.Times.once(),
        );
    });
    test('Test discovery adds cwd to pytest args when path is symlink', async () => {
        sinon.stub(fs.promises, 'lstat').callsFake(
            async () =>
                ({
                    isFile: () => true,
                    isSymbolicLink: () => true,
                } as fs.Stats),
        );
        sinon.stub(fs.promises, 'realpath').callsFake(async (pathEntered) => pathEntered.toString());

        // set up a config service with different pytest args
        const configServiceNew: IConfigurationService = ({
            getSettings: () => ({
                testing: {
                    pytestArgs: ['.', 'abc', 'xyz'],
                    cwd: expectedPath,
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

        adapter = new PytestTestDiscoveryAdapter(configServiceNew, outputChannel.object);
        adapter.discoverTests(uri, execFactory.object);
        // add in await and trigger
        await deferred.promise;
        await deferred2.promise;
        mockProc.trigger('close');

        // verification
        const expectedArgs = [
            '-m',
            'pytest',
            '-p',
            'vscode_pytest',
            '--collect-only',
            '.',
            'abc',
            'xyz',
            `--rootdir=${expectedPath}`,
        ];
        execService.verify(
            (x) =>
                x.execObservable(
                    expectedArgs,
                    typeMoq.It.is<SpawnOptions>((options) => {
                        assert.deepEqual(options.env, expectedExtraVariables);
                        assert.equal(options.cwd, expectedPath);
                        assert.equal(options.throwOnStdErr, true);
                        return true;
                    }),
                ),
            typeMoq.Times.once(),
        );
    });
    test('Test discovery adds cwd to pytest args when path parent is symlink', async () => {
        let counter = 0;
        sinon.stub(fs.promises, 'lstat').callsFake(
            async () =>
                ({
                    isFile: () => true,
                    isSymbolicLink: () => {
                        counter = counter + 1;
                        return counter > 2;
                    },
                } as fs.Stats),
        );

        sinon.stub(fs.promises, 'realpath').callsFake(async () => 'diff value');

        // set up a config service with different pytest args
        const configServiceNew: IConfigurationService = ({
            getSettings: () => ({
                testing: {
                    pytestArgs: ['.', 'abc', 'xyz'],
                    cwd: expectedPath,
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

        adapter = new PytestTestDiscoveryAdapter(configServiceNew, outputChannel.object);
        adapter.discoverTests(uri, execFactory.object);
        // add in await and trigger
        await deferred.promise;
        await deferred2.promise;
        mockProc.trigger('close');

        // verification
        const expectedArgs = [
            '-m',
            'pytest',
            '-p',
            'vscode_pytest',
            '--collect-only',
            '.',
            'abc',
            'xyz',
            `--rootdir=${expectedPath}`,
        ];
        execService.verify(
            (x) =>
                x.execObservable(
                    expectedArgs,
                    typeMoq.It.is<SpawnOptions>((options) => {
                        assert.deepEqual(options.env, expectedExtraVariables);
                        assert.equal(options.cwd, expectedPath);
                        assert.equal(options.throwOnStdErr, true);
                        return true;
                    }),
                ),
            typeMoq.Times.once(),
        );
    });
});
