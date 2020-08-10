// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess } from 'child_process';
import { inject, injectable } from 'inversify';
import { IDisposable } from 'monaco-editor';
import { ObservableExecutionResult } from '../../common/process/types';
import { Resource } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { PythonInterpreter } from '../../pythonEnvironments/info';
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
        workingDirectory: string,
        kernelSpec: IJupyterKernelSpec,
        interpreter?: PythonInterpreter
    ): Promise<{ observableOutput: ObservableExecutionResult<string>; daemon: IPythonKernelDaemon | undefined }> {
        const daemon = await this.daemonPool.get(resource, kernelSpec, interpreter);

        // Check to see if we have the type of kernelspec that we expect
        const args = kernelSpec.argv.slice();
        const modulePrefixIndex = args.findIndex((item) => item === '-m');
        if (modulePrefixIndex === -1) {
            throw new Error(
                `Unsupported KernelSpec file. args must be [<pythonPath>, '-m', <moduleName>, arg1, arg2, ..]. Provied ${args.join(
                    ' '
                )}`
            );
        }
        const moduleName = args[modulePrefixIndex + 1];
        const moduleArgs = args.slice(modulePrefixIndex + 2);
        const env = kernelSpec.env && Object.keys(kernelSpec.env).length > 0 ? kernelSpec.env : undefined;

        // The daemon pool can return back a non-IPythonKernelDaemon if daemon service is not supported or for Python 2.
        // Use a check for the daemon.start function here before we call it.
        if (!('start' in daemon)) {
            // If we don't have a KernelDaemon here then we have an execution service and should use that to launch
            const observableOutput = daemon.execModuleObservable(moduleName, moduleArgs, {
                env,
                cwd: workingDirectory
            });

            return { observableOutput, daemon: undefined };
        } else {
            // In the case that we do have a kernel deamon, just return it
            const observableOutput = await daemon.start(moduleName, moduleArgs, { env, cwd: workingDirectory });
            if (observableOutput.proc) {
                this.processesToDispose.push(observableOutput.proc);
            }
            return { observableOutput, daemon };
        }
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
