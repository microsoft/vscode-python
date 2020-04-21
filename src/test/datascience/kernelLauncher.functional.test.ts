// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { assert } from 'chai';
import { Uri } from 'vscode';

import { IFileSystem } from '../../client/common/platform/types';
import { IPythonExecutionFactory } from '../../client/common/process/types';
import { Resource } from '../../client/common/types';
import { Architecture } from '../../client/common/utils/platform';
import { JupyterZMQBinariesNotFoundError } from '../../client/datascience/jupyter/jupyterZMQBinariesNotFoundError';
import { KernelLauncher } from '../../client/datascience/kernel-launcher/kernelLauncher';
import { IKernelConnection, IKernelFinder } from '../../client/datascience/kernel-launcher/types';
import { InterpreterType, PythonInterpreter } from '../../client/interpreter/contracts';
import { PYTHON_PATH, sleep, waitForCondition } from '../common';
import { DataScienceIocContainer } from './dataScienceIocContainer';

suite('Kernel Launcher', () => {
    let ioc: DataScienceIocContainer;
    let kernelLauncher: KernelLauncher;
    let pythonInterpreter: PythonInterpreter;
    let resource: Resource;
    let kernelName: string;

    setup(() => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        const finder = ioc.serviceContainer.get<IKernelFinder>(IKernelFinder);
        const executionFactory = ioc.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        const file = ioc.serviceContainer.get<IFileSystem>(IFileSystem);
        kernelLauncher = new KernelLauncher(finder, executionFactory, file);

        pythonInterpreter = {
            path: PYTHON_PATH,
            sysPrefix: '1',
            envName: '1',
            sysVersion: '3.1.1.1',
            architecture: Architecture.x64,
            type: InterpreterType.Unknown
        };
        resource = Uri.file(PYTHON_PATH);
        kernelName = 'Python 3';
    });

    test('Launch from resource', async function () {
        if (!process.env.VSCODE_PYTHON_ROLLING) {
            // tslint:disable-next-line: no-invalid-this
            this.skip();
        } else {
            const kernel = await kernelLauncher.launch(resource, kernelName);
            const exited = new Promise<boolean>((resolve) => kernel.exited(() => resolve(true)));

            assert.isOk<IKernelConnection | undefined>(kernel.connection, 'Connection not found');

            // It should not exit.
            assert.isRejected(
                waitForCondition(() => exited, 5_000, 'Timeout'),
                'Timeout'
            );

            // Upon disposing, we should get an exit event within 100ms or less.
            // If this happens, then we know a process existed.
            kernel.dispose();
            assert.isRejected(
                waitForCondition(() => exited, 100, 'Timeout'),
                'Timeout'
            );
        }
    }).timeout(10_000);

    test('Launch from PythonInterpreter', async function () {
        if (!process.env.VSCODE_PYTHON_ROLLING) {
            // tslint:disable-next-line: no-invalid-this
            this.skip();
        } else {
            const kernel = await kernelLauncher.launch(pythonInterpreter, kernelName);
            const exited = new Promise<boolean>((resolve) => kernel.exited(() => resolve(true)));

            // It should not exit.
            assert.isRejected(
                waitForCondition(() => exited, 5_000, 'Timeout'),
                'Timeout'
            );

            assert.isOk<IKernelConnection | undefined>(kernel.connection, 'Connection not found');

            // Upon disposing, we should get an exit event within 100ms or less.
            // If this happens, then we know a process existed.
            kernel.dispose();
            assert.isRejected(
                waitForCondition(() => exited, 100, 'Timeout'),
                'Timeout'
            );
        }
    });

    test('Bind with ZMQ', async function () {
        if (!process.env.VSCODE_PYTHON_ROLLING) {
            // tslint:disable-next-line: no-invalid-this
            this.skip();
        } else {
            const kernel = await kernelLauncher.launch(resource, kernelName);

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
                kernel.dispose();
            }
        }
    });
});
