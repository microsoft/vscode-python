// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { inject, injectable } from 'inversify';
import * as portfinder from 'portfinder';
import { promisify } from 'util';
import * as uuid from 'uuid/v4';
import { IFileSystem } from '../../common/platform/types';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../../common/process/types';
import { Resource } from '../../common/types';
import { captureTelemetry } from '../../telemetry';
import { Telemetry } from '../constants';
import { IJupyterKernelSpec } from '../types';
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
        @inject(IPythonExecutionFactory) private pythonExecutionFactory: IPythonExecutionFactory,
        @inject(IProcessServiceFactory) private processExecutionFactory: IProcessServiceFactory,
        @inject(IFileSystem) private file: IFileSystem
    ) {}

    @captureTelemetry(Telemetry.KernelLauncherPerf)
    public async launch(kernelSpec: IJupyterKernelSpec, resource: Resource): Promise<IKernelProcess> {
        const connection = await this.getKernelConnection();
        const kernelProcess = new KernelProcess(
            this.pythonExecutionFactory,
            this.processExecutionFactory,
            this.file,
            connection,
            kernelSpec,
            resource
        );
        await kernelProcess.launch();
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
        KernelLauncher.nextFreePortToTryAndUse = Math.max(...ports);

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
