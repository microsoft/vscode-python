// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { assert } from 'chai';
import { Uri } from 'vscode';

import { ChildProcess } from 'child_process';
import { IFileSystem } from '../../client/common/platform/types';
import { Resource } from '../../client/common/types';
import { Architecture } from '../../client/common/utils/platform';
import { JupyterZMQBinariesNotFoundError } from '../../client/datascience/jupyter/jupyterZMQBinariesNotFoundError';
import { KernelLauncher } from '../../client/datascience/kernel-launcher/kernelLauncher';
import { IKernelConnection, IKernelFinder, IKernelProcess } from '../../client/datascience/kernel-launcher/types';
import { IInterpreterService, InterpreterType, PythonInterpreter } from '../../client/interpreter/contracts';
import { PYTHON_PATH, sleep } from '../common';
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
        const interpreterService = ioc.serviceContainer.get<IInterpreterService>(IInterpreterService);
        const file = ioc.serviceContainer.get<IFileSystem>(IFileSystem);
        const finder = ioc.serviceContainer.get<IKernelFinder>(IKernelFinder);
        const kernelProcess = ioc.serviceContainer.get<IKernelProcess>(IKernelProcess);
        kernelLauncher = new KernelLauncher(interpreterService, file, finder, kernelProcess);
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

    test('Launch from resource', async function() {
        if (!process.env.VSCODE_PYTHON_ROLLING) {
            // tslint:disable-next-line: no-invalid-this
            this.skip();
        } else {
            const kernel = await kernelLauncher.launch(resource, kernelName);

            assert.isOk<IKernelConnection | undefined>(kernel.connection, 'Connection not found');
            assert.isOk<ChildProcess | undefined>(kernel.process, 'Child Process not found');

            await kernel.dispose();
        }
    });

    test('Launch from PythonInterpreter', async function() {
        if (!process.env.VSCODE_PYTHON_ROLLING) {
            // tslint:disable-next-line: no-invalid-this
            this.skip();
        } else {
            const kernel = await kernelLauncher.launch(pythonInterpreter, kernelName);

            assert.isOk<IKernelConnection | undefined>(kernel.connection, 'Connection not found');
            assert.isOk<ChildProcess | undefined>(kernel.process, 'Child Process not found');

            await kernel.dispose();
        }
    });

    test('Bind with ZMQ', async function() {
        if (!process.env.VSCODE_PYTHON_ROLLING) {
            // tslint:disable-next-line: no-invalid-this
            this.skip();
        } else {
            const kernel = await kernelLauncher.launch(resource, kernelName);

            try {
                const zmq = await import('zeromq');
                const sock = new zmq.Push();

                await sock.bind(`tcp://${kernel.connection!.ip}:${kernel.connection!.stdin_port}`);
                sock.send('some work').ignoreErrors(); // This will never return unless there's a listener. Just used for testing the API is available
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
