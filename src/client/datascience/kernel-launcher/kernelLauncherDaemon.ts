// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess } from 'child_process';
import { inject, injectable } from 'inversify';
import { IDisposable } from 'monaco-editor';
import { ObservableExecutionResult } from '../../common/process/types';
import { Resource } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { IJupyterKernelSpec } from '../types';
import { KernelDaemonPool } from './kernelDaemonPool';
import { IPythonKernelDaemon } from './types';

/**
 * Launches a Python kernel in a daemon.
 * We need a daemon for the sole purposes of being able to interrupt kernels in Windows.
 * (Else we don't need a kernel).
 */
@injectable()
export class PythonKernelLauncherDaemon implements IDisposable {
    private readonly processesToDispose: ChildProcess[] = [];
    constructor(@inject(KernelDaemonPool) private readonly daemonPool: KernelDaemonPool) {}
    public async launch(
        resource: Resource,
        kernelSpec: IJupyterKernelSpec
    ): Promise<{ observableResult: ObservableExecutionResult<string>; daemon: IPythonKernelDaemon }> {
        const pythonPath = kernelSpec.argv[0];
        await this.daemonPool.preWarmKernelDaemons();
        const daemon = await this.daemonPool.get(resource, pythonPath);
        const args = kernelSpec.argv.slice();
        args.shift(); // Remove executable.
        args.shift(); // Remove `-m`.
        const moduleName = args.shift();
        if (!moduleName) {
            const providedArgs = kernelSpec.argv.join(' ');
            throw new Error(
                `Unsupported KernelSpec file. args must be [<pythonPath>, '-m', <moduleName>, arg1, arg2, ..]. Provied ${providedArgs}`
            );
        }
        const env = kernelSpec.env && Object.keys(kernelSpec.env).length > 0 ? kernelSpec.env : undefined;
        const observableResult = await daemon.start(moduleName, args, { env });
        if (observableResult.proc) {
            this.processesToDispose.push(observableResult.proc);
        }
        return { observableResult, daemon };
    }
    public dispose() {
        while (this.processesToDispose.length) {
            try {
                this.processesToDispose.shift()!.kill();
            } catch {
                noop();
            }
        }
    }
}
