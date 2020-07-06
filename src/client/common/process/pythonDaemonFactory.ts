// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { ChildProcess } from 'child_process';
import * as path from 'path';
import {
    createMessageConnection,
    MessageConnection,
    RequestType,
    StreamMessageReader,
    StreamMessageWriter
} from 'vscode-jsonrpc/node';

import { EXTENSION_ROOT_DIR } from '../../constants';
import { PYTHON_WARNINGS } from '../constants';
import { traceDecorators, traceError } from '../logger';
import { IPlatformService } from '../platform/types';
import { IDisposable, IDisposableRegistry } from '../types';
import { createDeferred } from '../utils/async';
import { BasePythonDaemon } from './baseDaemon';
import { PythonDaemonExecutionService } from './pythonDaemon';
import { DaemonExecutionFactoryCreationOptions, IPythonDaemonExecutionService, IPythonExecutionService } from './types';

export class PythonDaemonFactory {
    protected readonly envVariables: NodeJS.ProcessEnv;
    protected readonly pythonPath: string;
    constructor(
        protected readonly disposables: IDisposableRegistry,
        protected readonly options: DaemonExecutionFactoryCreationOptions,
        protected readonly pythonExecutionService: IPythonExecutionService,
        protected readonly platformService: IPlatformService,
        protected readonly activatedEnvVariables?: NodeJS.ProcessEnv
    ) {
        if (!options.pythonPath) {
            throw new Error('options.pythonPath is empty when it shoud not be');
        }
        this.pythonPath = options.pythonPath;
        // Setup environment variables for the daemon.
        // The daemon must have access to the Python Module that'll run the daemon
        // & also access to a Python package used for the JSON rpc comms.
        const envPythonPath = `${path.join(EXTENSION_ROOT_DIR, 'pythonFiles')}${path.delimiter}${path.join(
            EXTENSION_ROOT_DIR,
            'pythonFiles',
            'lib',
            'python'
        )}`;
        this.envVariables = this.activatedEnvVariables ? { ...this.activatedEnvVariables } : { ...process.env };
        this.envVariables.PYTHONPATH = this.envVariables.PYTHONPATH
            ? `${this.envVariables.PYTHONPATH}${path.delimiter}${envPythonPath}`
            : envPythonPath;
        this.envVariables.PYTHONUNBUFFERED = '1';

        // Always ignore warnings as the user should never see the output of the daemon running
        this.envVariables[PYTHON_WARNINGS] = 'ignore';
    }
    @traceDecorators.error('Failed to create daemon')
    public async createDaemonService<T extends IPythonDaemonExecutionService | IDisposable>(): Promise<T> {
        // Add '--log-file=/Users/donjayamanne/Desktop/Development/vsc/pythonVSCode/daaemon.log' to log to a file.
        const loggingArgs: string[] = ['-v']; // Log information messages or greater (see daemon.__main__.py for options).

        const args = (this.options.daemonModule ? [`--daemon-module=${this.options.daemonModule}`] : []).concat(
            loggingArgs
        );
        const env = this.envVariables;
        const daemonProc = this.pythonExecutionService!.execModuleObservable(
            'vscode_datascience_helpers.daemon',
            args,
            { env }
        );
        if (!daemonProc.proc) {
            throw new Error('Failed to create Daemon Proc');
        }
        const connection = this.createConnection(daemonProc.proc);

        connection.listen();
        let stdError = '';
        let procEndEx: Error | undefined;
        daemonProc.proc.stderr.on('data', (data: string | Buffer) => {
            data = typeof data === 'string' ? data : data.toString('utf8');
            stdError += data;
        });
        daemonProc.proc.on('error', (ex) => (procEndEx = ex));

        try {
            await this.testDaemon(connection);

            const cls = this.options.daemonClass ?? PythonDaemonExecutionService;
            const instance = new cls(
                this.pythonExecutionService,
                this.platformService,
                this.pythonPath,
                daemonProc.proc,
                connection
            );
            if (instance instanceof BasePythonDaemon) {
                this.disposables.push(instance);
                return (instance as unknown) as T;
            }
            throw new Error(`Daemon class ${cls.name} must inherit BasePythonDaemon.`);
        } catch (ex) {
            traceError('Failed to start the Daemon, StdErr: ', stdError);
            traceError('Failed to start the Daemon, ProcEndEx', procEndEx || ex);
            traceError('Failed  to start the Daemon, Ex', ex);
            throw ex;
        }
    }
    /**
     * Protected so we can override for testing purposes.
     */
    protected createConnection(proc: ChildProcess) {
        return createMessageConnection(new StreamMessageReader(proc.stdout), new StreamMessageWriter(proc.stdin));
    }
    /**
     * Tests whether a daemon is usable or not by checking whether it responds to a simple ping.
     * If a daemon doesn't reply to a ping in 5s, then its deemed to be dead/not usable.
     *
     * @private
     * @param {MessageConnection} connection
     * @memberof PythonDaemonExecutionServicePool
     */
    @traceDecorators.error('Pinging Daemon Failed')
    protected async testDaemon(connection: MessageConnection) {
        // If we don't get a reply to the ping in 5 seconds assume it will never work. Bomb out.
        // At this point there should be some information logged in stderr of the daemon process.
        const fail = createDeferred<{ pong: string }>();
        const timer = setTimeout(() => fail.reject(new Error('Timeout waiting for daemon to start')), 5_000);
        const request = new RequestType<{ data: string }, { pong: string }, void, void>('ping');
        // Check whether the daemon has started correctly, by sending a ping.
        const result = await Promise.race([fail.promise, connection.sendRequest(request, { data: 'hello' })]);
        clearTimeout(timer);
        if (result.pong !== 'hello') {
            throw new Error(`Daemon did not reply to the ping, received: ${result.pong}`);
        }
    }
}
