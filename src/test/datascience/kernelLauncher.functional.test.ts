// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { assert } from 'chai';
import * as typeMoq from 'typemoq';
import { Uri } from 'vscode';

import { ChildProcess } from 'child_process';
import { Resource } from '../../client/common/types';
import { KernelLauncher } from '../../client/datascience/kernel-launcher/kernelLauncher';
import { IKernelConnection } from '../../client/datascience/kernel-launcher/types';
import { PythonInterpreter } from '../../client/interpreter/contracts';
import { IServiceContainer } from '../../client/ioc/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';

suite('Kernel Launcher', () => {
    let ioc: DataScienceIocContainer;
    let kernelLauncher: KernelLauncher;
    let pythonInterpreter: typeMoq.IMock<PythonInterpreter>;
    let resource: Resource;

    setup(() => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        kernelLauncher = new KernelLauncher(ioc.serviceContainer);
        pythonInterpreter = typeMoq.Mock.ofType<PythonInterpreter>();
        resource = Uri.file(__dirname);
    });

    test('Launch from resource', async () => {
        const kernel = await kernelLauncher.launch(resource);

        assert.isOk<IKernelConnection>(kernel.connection, 'Connection not found');
        assert.isOk<ChildProcess>(kernel.process, 'Child Process not found');

        kernel.dispose();
    });

    test('Launch from PythonInterpreter', async () => {
        const kernel = await kernelLauncher.launch(pythonInterpreter.object);

        assert.isOk<IKernelConnection>(kernel.connection, 'Connection not found');
        assert.isOk<ChildProcess>(kernel.process, 'Child Process not found');

        kernel.dispose();
    });
});
