// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { inject, injectable } from 'inversify';
import * as portfinder from 'portfinder';
import { promisify } from 'util';
import * as uuid from 'uuid/v4';
import { IProcessServiceFactory } from '../../common/process/types';
import { Resource } from '../../common/types';
import { captureTelemetry } from '../../telemetry';
import { Telemetry } from '../constants';
import { KernelSpecConnectionMetadata, PythonKernelConnectionMetadata } from '../jupyter/kernels/types';
import { IDataScienceFileSystem } from '../types';
import { KernelDaemonPool } from './kernelDaemonPool';
import { KernelProcess } from './kernelProcess';
import { IKernelConnection, IKernelLauncher, IKernelProcess } from './types';

const PortToStartFrom = 9_000;

// Launches and returns a kernel process given a resource or python interpreter.
// If the given interpreter is undefined, it will try to use the selected interpreter.
// If the selected interpreter doesn't have a kernel, it will find a kernel on disk and use that.
@injectable()
export class KernelLauncher implements IKernelLauncher {
    private static nextFreePortToTryAndUse = PortToStartFrom;
    constructor(
        @inject(IProcessServiceFactory) private processExecutionFactory: IProcessServiceFactory,
        @inject(IDataScienceFileSystem) private readonly fs: IDataScienceFileSystem,
        @inject(KernelDaemonPool) private readonly daemonPool: KernelDaemonPool
    ) {}

    @captureTelemetry(Telemetry.KernelLauncherPerf)
    public async launch(
        kernelConnectionMetadata: KernelSpecConnectionMetadata | PythonKernelConnectionMetadata,
        resource: Resource,
        workingDirectory: string
    ): Promise<IKernelProcess> {
        const connection = await this.getKernelConnection();
        const kernelProcess = new KernelProcess(
            this.processExecutionFactory,
            this.daemonPool,
            connection,
            kernelConnectionMetadata,
            this.fs,
            resource
        );
        await kernelProcess.launch(workingDirectory);
        return kernelProcess;
    }

    private async getKernelConnection(): Promise<IKernelConnection> {
        const getPorts = promisify(portfinder.getPorts);
        // Ports may have been freed, hence start from begining.
        const port =
            KernelLauncher.nextFreePortToTryAndUse > PortToStartFrom + 1_000
                ? PortToStartFrom
                : KernelLauncher.nextFreePortToTryAndUse;
        const ports = await getPorts(5, { host: '127.0.0.1', port });
        // We launch restart kernels in the background, its possible other session hasn't started.
        // Ensure we do not use same ports.
        KernelLauncher.nextFreePortToTryAndUse = Math.max(...ports) + 1;

        return {
            version: 1,
            key: uuid(),
            signature_scheme: 'hmac-sha256',
            transport: 'tcp',
            ip: '127.0.0.1',
            hb_port: ports[0],
            control_port: ports[1],
            shell_port: ports[2],
            stdin_port: ports[3],
            iopub_port: ports[4]
        };
    }
}
