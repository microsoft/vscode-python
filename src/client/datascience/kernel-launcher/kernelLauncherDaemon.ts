// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess } from 'child_process';
import { inject, injectable } from 'inversify';
import { IDisposable } from 'monaco-editor';
import { IPythonExecutionFactory, ObservableExecutionResult } from '../../common/process/types';
import { Resource } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { KernelLauncherDaemonModule } from '../constants';
import { IJupyterKernelSpec } from '../types';
import { PythonKernelDaemon } from './kernelDaemon';
import { IPythonKernelDaemon } from './types';

/**
 * Launches a Python kernel in a daemon.
 * We need a daemon for the sole purposes of being able to interrupt kernels in Windows.
 * (Else we don't need a kernel).
 */
@injectable()
export class PythonKernelLauncherDaemon implements IDisposable {
    private readonly processesToDispose: ChildProcess[] = [];
    constructor(@inject(IPythonExecutionFactory) private readonly pythonExecutionFactory: IPythonExecutionFactory) {}
    public async launch(
        resource: Resource,
        kernelSpec: IJupyterKernelSpec
    ): Promise<{ observableResult: ObservableExecutionResult<string>; daemon: IPythonKernelDaemon }> {
        const pythonPath = kernelSpec.argv[0];
        const daemon = await this.pythonExecutionFactory.createDaemon<IPythonKernelDaemon>({
            daemonModule: KernelLauncherDaemonModule,
            pythonPath: pythonPath,
            daemonClass: PythonKernelDaemon,
            dedicated: true,
            resource
        });
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
