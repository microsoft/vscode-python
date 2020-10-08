// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as fsextra from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import * as portfinder from 'portfinder';
import { promisify } from 'util';
import * as uuid from 'uuid/v4';
import { traceInfo } from '../../common/logger';
import { IProcessServiceFactory } from '../../common/process/types';
import { Resource } from '../../common/types';
import { captureTelemetry } from '../../telemetry';
import { Telemetry } from '../constants';
import { KernelSpecConnectionMetadata, PythonKernelConnectionMetadata } from '../jupyter/kernels/types';
import { IDataScienceFileSystem } from '../types';
import { KernelDaemonPool } from './kernelDaemonPool';
import { KernelProcess } from './kernelProcess';
import { IKernelConnection, IKernelLauncher, IKernelProcess } from './types';

const PortFormatString = `kernelLauncherPortStart_{0}.tmp`;

// Launches and returns a kernel process given a resource or python interpreter.
// If the given interpreter is undefined, it will try to use the selected interpreter.
// If the selected interpreter doesn't have a kernel, it will find a kernel on disk and use that.
@injectable()
export class KernelLauncher implements IKernelLauncher {
    private static startPortFS: number = 0;
    private static startPortPromise = KernelLauncher.computeStartPort();
    private static nextFreePortToTryAndUsePromise = KernelLauncher.startPortPromise;
    constructor(
        @inject(IProcessServiceFactory) private processExecutionFactory: IProcessServiceFactory,
        @inject(IDataScienceFileSystem) private readonly fs: IDataScienceFileSystem,
        @inject(KernelDaemonPool) private readonly daemonPool: KernelDaemonPool
    ) {}

    // This function is public so it can be called when a test shuts down
    public static cleanupStartPort() {
        // Cleanup our start port file
        fsextra.close(KernelLauncher.startPortFS).ignoreErrors();

        // Destroy the file
        KernelLauncher.startPortPromise
            .then((p) => {
                traceInfo(`Cleaning up port start file : ${p}`);

                const filePath = path.join(os.tmpdir(), PortFormatString.format(p.toString()));
                return fsextra.pathExists(filePath).then((e) => {
                    if (e) {
                        return fsextra.remove(filePath);
                    }
                });
            })
            .ignoreErrors();
    }

    private static async computeStartPort(): Promise<number> {
        // Since multiple instances of VS code may be running, write our best guess to a shared file
        let portStart = 9_000;
        let result = 0;
        while (result === 0 && portStart < 65_000) {
            try {
                // Try creating a file (not worrying about two instances starting at exactly the same time. That's much less likely)
                const filePath = path.join(os.tmpdir(), PortFormatString.format(portStart.toString()));

                // Create a file stream object that should fail if the file exists
                KernelLauncher.startPortFS = await fsextra.open(filePath, 'wx');

                // If that works, we have our port
                result = portStart;
            } catch {
                // If that fails, it should mean the file already exists
                portStart += 1_000;
            }
        }

        traceInfo(`Computed port start for KernelLauncher is : ${result}`);

        // Before finishing setup an on exit handler for the current process.
        // Note we have to do this as a proc exit handler instead of IDisposable because
        // during a test run the container is destroyed over and over again. What we need
        // is for the same process to always use the same start port.
        process.on('exit', KernelLauncher.cleanupStartPort);

        return result;
    }

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

    private async getPorts(): Promise<number[]> {
        const getPorts = promisify(portfinder.getPorts);

        // Have to wait for static port lookup (it handles case where two VS code instances are running)
        const nextFreePort = await KernelLauncher.nextFreePortToTryAndUsePromise;
        const startPort = await KernelLauncher.startPortPromise;

        // Ports may have been freed, hence start from begining.
        const port = nextFreePort > startPort + 1_000 ? startPort : nextFreePort;

        // Then get the next set starting at that point
        const ports = await getPorts(5, { host: '127.0.0.1', port });

        // We launch restart kernels in the background, its possible other session hasn't started.
        // Ensure we do not use same ports.
        KernelLauncher.nextFreePortToTryAndUsePromise = Promise.resolve(Math.max(...ports) + 1);

        return ports;
    }

    private async getKernelConnection(): Promise<IKernelConnection> {
        const ports = await this.getPorts();
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
