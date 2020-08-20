// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { assert, use } from 'chai';

import { KernelMessage } from '@jupyterlab/services';
import * as uuid from 'uuid/v4';
import { IProcessServiceFactory } from '../../client/common/process/types';
import { createDeferred } from '../../client/common/utils/async';
import { JupyterZMQBinariesNotFoundError } from '../../client/datascience/jupyter/jupyterZMQBinariesNotFoundError';
import { KernelDaemonPool } from '../../client/datascience/kernel-launcher/kernelDaemonPool';
import { KernelLauncher } from '../../client/datascience/kernel-launcher/kernelLauncher';
import { IKernelConnection, IKernelFinder } from '../../client/datascience/kernel-launcher/types';
import { createRawKernel } from '../../client/datascience/raw-kernel/rawKernel';
import { IDataScienceFileSystem, IJupyterKernelSpec } from '../../client/datascience/types';
import { PythonEnvironment } from '../../client/pythonEnvironments/info';
import { sleep, waitForCondition } from '../common';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { takeSnapshot, writeDiffSnapshot } from './helpers';
import { MockKernelFinder } from './mockKernelFinder';
import { requestExecute } from './raw-kernel/rawKernelTestHelpers';

// Chai as promised is not part of this file
import * as chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

suite('DataScience - Kernel Launcher', () => {
    let ioc: DataScienceIocContainer;
    let kernelLauncher: KernelLauncher;
    let pythonInterpreter: PythonEnvironment | undefined;
    let kernelSpec: IJupyterKernelSpec;
    let kernelFinder: MockKernelFinder;
    // tslint:disable-next-line: no-any
    let snapshot: any;

    suiteSetup(() => {
        snapshot = takeSnapshot();
    });

    setup(async () => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        kernelFinder = new MockKernelFinder(ioc.get<IKernelFinder>(IKernelFinder));
        const processServiceFactory = ioc.get<IProcessServiceFactory>(IProcessServiceFactory);
        const daemonPool = ioc.get<KernelDaemonPool>(KernelDaemonPool);
        const fileSystem = ioc.get<IDataScienceFileSystem>(IDataScienceFileSystem);
        kernelLauncher = new KernelLauncher(processServiceFactory, fileSystem, daemonPool);
        await ioc.activate();
        if (!ioc.mockJupyter) {
            pythonInterpreter = await ioc.getJupyterCapableInterpreter();
            kernelSpec = {
                argv: [pythonInterpreter!.path, '-m', 'ipykernel_launcher', '-f', '{connection_file}'],
                display_name: 'new kernel',
                language: 'python',
                name: 'newkernel',
                path: 'path',
                env: undefined
            };
        }
    });

    suiteTeardown(() => {
        writeDiffSnapshot(snapshot, 'KernelLauncher');
    });

    test('Launch from kernelspec', async function () {
        if (!process.env.VSCODE_PYTHON_ROLLING) {
            // tslint:disable-next-line: no-invalid-this
            this.skip();
        } else {
            let exitExpected = false;
            const deferred = createDeferred<boolean>();
            const kernel = await kernelLauncher.launch(
                { kernelSpec, kind: 'startUsingKernelSpec' },
                undefined,
                process.cwd()
            );
            kernel.exited(() => {
                if (exitExpected) {
                    deferred.resolve(true);
                } else {
                    deferred.reject(new Error('Kernel exited prematurely'));
                }
            });

            assert.isOk<IKernelConnection | undefined>(kernel.connection, 'Connection not found');

            // It should not exit.
            await assert.isRejected(
                waitForCondition(() => deferred.promise, 2_000, 'Timeout'),
                'Timeout'
            );

            // Upon disposing, we should get an exit event within 100ms or less.
            // If this happens, then we know a process existed.
            exitExpected = true;
            await kernel.dispose();
            await deferred.promise;
        }
    }).timeout(10_000);

    test('Launch with environment', async function () {
        if (!process.env.VSCODE_PYTHON_ROLLING || !pythonInterpreter) {
            // tslint:disable-next-line: no-invalid-this
            this.skip();
        } else {
            const spec: IJupyterKernelSpec = {
                name: 'foo',
                language: 'python',
                path: pythonInterpreter.path,
                display_name: pythonInterpreter.displayName || 'foo',
                argv: [pythonInterpreter.path, '-m', 'ipykernel_launcher', '-f', '{connection_file}'],
                env: {
                    TEST_VAR: '1'
                }
            };
            kernelFinder.addKernelSpec(pythonInterpreter.path, spec);

            const kernel = await kernelLauncher.launch(
                { kernelSpec: spec, kind: 'startUsingKernelSpec' },
                undefined,
                process.cwd()
            );
            const exited = new Promise<boolean>((resolve) => kernel.exited(() => resolve(true)));

            assert.isOk<IKernelConnection | undefined>(kernel.connection, 'Connection not found');

            // Send a request to print out the env vars
            const rawKernel = createRawKernel(kernel, uuid());

            const result = await requestExecute(rawKernel, 'import os\nprint(os.getenv("TEST_VAR"))');
            assert.ok(result, 'No result returned');
            // Should have a stream output message
            const output = result.find((r) => r.header.msg_type === 'stream') as KernelMessage.IStreamMsg;
            assert.ok(output, 'no stream output');
            assert.equal(output.content.text, '1\n', 'Wrong content found on message');

            // Upon disposing, we should get an exit event within 100ms or less.
            // If this happens, then we know a process existed.
            await kernel.dispose();
            assert.isRejected(
                waitForCondition(() => exited, 100, 'Timeout'),
                'Timeout'
            );
        }
    }).timeout(10_000);

    test('Bind with ZMQ', async function () {
        if (!process.env.VSCODE_PYTHON_ROLLING) {
            // tslint:disable-next-line: no-invalid-this
            this.skip();
        } else {
            const kernel = await kernelLauncher.launch(
                { kernelSpec, kind: 'startUsingKernelSpec' },
                undefined,
                process.cwd()
            );

            try {
                const zmq = await import('zeromq');
                const sock = new zmq.Pull();

                sock.connect(`tcp://${kernel.connection!.ip}:${kernel.connection!.stdin_port}`);
                sock.receive().ignoreErrors(); // This will never return unless the kenrel process sends something. Just used for testing the API is available
                await sleep(50);
                sock.close();
            } catch (e) {
                throw new JupyterZMQBinariesNotFoundError(e.toString());
            } finally {
                await kernel.dispose();
            }
        }
    });
});
