// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess } from 'child_process';
import { Subject } from 'rxjs/Subject';
import { MessageConnection, NotificationType, RequestType0 } from 'vscode-jsonrpc';
import { BasePythonDaemon } from '../../common/process/baseDaemon';
import {
    IPythonExecutionService,
    ObservableExecutionResult,
    Output,
    SpawnOptions,
    StdErrError
} from '../../common/process/types';
import { IPythonKernelDaemon, PythonKernelDiedError } from './types';

export class PythonKernelDaemon extends BasePythonDaemon implements IPythonKernelDaemon {
    constructor(
        pythonExecutionService: IPythonExecutionService,
        pythonPath: string,
        proc: ChildProcess,
        connection: MessageConnection
    ) {
        super(pythonExecutionService, pythonPath, proc, connection);
    }
    public async interrupt() {
        const request = new RequestType0<void, void, void>('interrupt_kernel');
        await this.sendRequestWithoutArgs(request);
    }
    public async kill() {
        const request = new RequestType0<void, void, void>('kill_kernel');
        await this.sendRequestWithoutArgs(request);
    }
    public async start(
        moduleName: string,
        args: string[],
        options: SpawnOptions
    ): Promise<ObservableExecutionResult<string>> {
        const subject = new Subject<Output<string>>();
        // Message from daemon when kernel dies.
        const KernelDiedNotification = new NotificationType<{ exit_code: string; reason?: string }, void>(
            'kernel_died'
        );
        this.connection.onNotification(KernelDiedNotification, (output) => {
            subject.error(
                new PythonKernelDiedError({ exitCode: parseInt(output.exit_code, 10), reason: output.reason })
            );
        });

        // All output messages from daemon from here on are considered to be coming from the kernel.
        // This is because the kernel is a long running process and that will be the only code in the daemon
        // sptting stuff into stdout/stderr.
        this.outputObservale.subscribe(
            (out) => {
                if (out.source === 'stderr' && options.throwOnStdErr) {
                    subject.error(new StdErrError(out.out));
                } else if (out.source === 'stderr' && options.mergeStdOutErr) {
                    subject.next({ source: 'stdout', out: out.out });
                } else {
                    subject.next(out);
                }
            },
            subject.error.bind(subject),
            subject.complete.bind(subject)
        );

        // If the daemon dies, then kernel is also dead.
        this.closed.catch((error) => subject.error(new PythonKernelDiedError({ error })));

        // No need of the output here, we'll tap into the output coming from daemon `this.outputObservale`.
        // This is required because execModule will never end.
        // We cannot use `execModuleObservable` as that only works where the daemon is busy seeerving on request and we wait for it to finish.
        // In this case we're never going to wait for the module to run to end. Cuz when we run `pytohn -m ipykernel`, it never ends.
        // It only ends when the kernel dies, meaning the kernel process is dead.
        // What we need is to be able to run the module and keep getting a stream of stdout/stderr.
        // & also be able to execute other python code. I.e. we need a daemon.
        // For this we run the `ipykernel` code in a separate thread.
        // This is why when we run `execModule` in the Kernel daemon, it finishes (comes back) quickly.
        // However in reality it is running in the background.
        // See `m_exec_module_observable` in `kernel_launcher_daemon.py`.
        await this.execModule(moduleName, args, options);

        return {
            proc: this.proc,
            dispose: () => this.dispose(),
            out: subject
        };
    }
}
