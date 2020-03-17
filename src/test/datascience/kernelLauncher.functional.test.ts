// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { assert } from 'chai';
import { Uri } from 'vscode';

import { ChildProcess } from 'child_process';
import { IPythonExecutionFactory } from '../../client/common/process/types';
import { Resource } from '../../client/common/types';
import { Architecture } from '../../client/common/utils/platform';
import { KernelLauncher } from '../../client/datascience/kernel-launcher/kernelLauncher';
import { IKernelConnection } from '../../client/datascience/kernel-launcher/types';
import { InterpreterType, PythonInterpreter } from '../../client/interpreter/contracts';
import { PYTHON_PATH } from '../common';
import { DataScienceIocContainer } from './dataScienceIocContainer';

suite('Kernel Launcher', () => {
    let ioc: DataScienceIocContainer;
    let kernelLauncher: KernelLauncher;
    let pythonInterpreter: PythonInterpreter;
    let resource: Resource;

    setup(() => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        const execFactory = ioc.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        kernelLauncher = new KernelLauncher(execFactory);
        pythonInterpreter = {
            path: PYTHON_PATH,
            sysPrefix: '1',
            envName: '1',
            sysVersion: '3.1.1.1',
            architecture: Architecture.x64,
            type: InterpreterType.Unknown
        };
        resource = Uri.file(PYTHON_PATH);
    });

    test('Launch from resource', async () => {
        const kernel = await kernelLauncher.launch(resource);

        assert.isOk<IKernelConnection>(kernel.connection, 'Connection not found');
        assert.isOk<ChildProcess>(kernel.process, 'Child Process not found');

        kernel.dispose();
    });

    test('Launch from PythonInterpreter', async () => {
        const kernel = await kernelLauncher.launch(pythonInterpreter);

        assert.isOk<IKernelConnection>(kernel.connection, 'Connection not found');
        assert.isOk<ChildProcess>(kernel.process, 'Child Process not found');

        kernel.dispose();
    });
});
