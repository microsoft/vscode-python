// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { createMessageConnection, MessageConnection, RequestType, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { traceDecorators, traceError } from '../logger';
import { IDisposable } from '../types';
import { sleep } from '../utils/async';
import { noop } from '../utils/misc';
import { ProcessService } from './proc';
import { PythonDaemonExecutionService } from './pythonDaemon';
import {
    DaemonExecutionFactoryCreationOptions,
    ExecutionResult,
    InterpreterInfomation,
    IPythonDaemonExecutionService,
    IPythonExecutionService,
    ObservableExecutionResult,
    SpawnOptions
} from './types';

type DaemonType = 'StandardDaemon' | 'ObservableDaemon';

export class PythonDaemonExecutionServicePool implements IPythonDaemonExecutionService {
    private disposables: IDisposable[] = [];
    private readonly daemons: IPythonDaemonExecutionService[] = [];
    private readonly observableDaemons: IPythonDaemonExecutionService[] = [];
    private readonly envVariables: NodeJS.ProcessEnv;
    private logId: number = 0;
    constructor(
        private readonly options: DaemonExecutionFactoryCreationOptions,
        private readonly pythonPath: string,
        private readonly pythonExecutionService: IPythonExecutionService,
        private readonly activatedEnvVariables?: NodeJS.ProcessEnv
    ) {
        // Setup environment variables for the daemon.
        // The daemon must have access to the Python Module that'll run the daemon
        // & also access to a Python package used for the JSON rpc comms.
        const envPythonPath = `${path.join(EXTENSION_ROOT_DIR, 'pythonFiles')}${path.delimiter}${path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'lib', 'python')}`;
        this.envVariables = this.activatedEnvVariables ? { ...this.activatedEnvVariables } : {};
        this.envVariables.PYTHONPATH = this.envVariables.PYTHONPATH ? `${this.envVariables.PYTHONPATH}${path.delimiter}${envPythonPath}` : envPythonPath;
        this.envVariables.PYTHONUNBUFFERED = '1';
    }
    public async initialize() {
        // tslint:disable-next-line: prefer-array-literal
        const promises = [...new Array(this.options.daemonCount || 2).keys()].map(() => this.addDaemonService('StandardDaemon'));
        // tslint:disable-next-line: prefer-array-literal
        const promises2 = [...new Array(this.options.daemonCount || 2).keys()].map(() => this.addDaemonService('ObservableDaemon'));

        await Promise.all([promises, promises2]);
    }
    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
    public async getInterpreterInformation(): Promise<InterpreterInfomation | undefined> {
        return this.execWrapper(daemon => daemon.getInterpreterInformation());
    }
    public async getExecutablePath(): Promise<string> {
        return this.execWrapper(daemon => daemon.getExecutablePath());
    }
    public async isModuleInstalled(moduleName: string): Promise<boolean> {
        return this.execWrapper(daemon => daemon.isModuleInstalled(moduleName));
    }
    public async exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        return this.execWrapper(daemon => daemon.exec(args, options));
    }
    public async execModule(moduleName: string, args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        return this.execWrapper(daemon => daemon.execModule(moduleName, args, options));
    }
    public execObservable(args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        return this.execObservableWrapper(daemon => daemon.execObservable(args, options));    }
    public execModuleObservable(moduleName: string, args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        return this.execObservableWrapper(daemon => daemon.execModuleObservable(moduleName, args, options));
    }
    /**
     * Wrapper for all promise operations to be performed on a daemon.
     * Gets a daemon from the pool, executes the required code, then returns the daemon back into the pool.
     *
     * @private
     * @template T
     * @param {(daemon: IPythonExecutionService) => Promise<T>} cb
     * @returns {Promise<T>}
     * @memberof PythonDaemonExecutionServicePool
     */
    private async execWrapper<T>(cb: (daemon: IPythonExecutionService) => Promise<T>): Promise<T> {
        const daemon = await this.popDaemonFromPool();
        return cb(daemon).finally(() => this.pushDaemonIntoPool('StandardDaemon', daemon));

    }
    /**
     * Wrapper for all observable operations to be performed on a daemon.
     * Gets a daemon from the pool, executes the required code, then returns the daemon back into the pool.
     *
     * @private
     * @param {(daemon: IPythonExecutionService) => ObservableExecutionResult<string>} cb
     * @returns {ObservableExecutionResult<string>}
     * @memberof PythonDaemonExecutionServicePool
     */
    private execObservableWrapper(cb: (daemon: IPythonExecutionService) => ObservableExecutionResult<string>): ObservableExecutionResult<string> {
        const daemon = this.popDaemonFromObservablePool();
        const daemonProc = (daemon as PythonDaemonExecutionService).proc;

        const result = cb(daemon);
        let completed = false;
        const completeHandler = () => {
            if (completed){
                return;
            }
            completed = true;
            if (!daemonProc.killed && ProcessService.isAlive(daemonProc.pid)){
                this.pushDaemonIntoPool('ObservableDaemon', daemon);
            } else {
                // Possible daemon is dead (explicitly killed or died due to some error).
                this.addDaemonService('ObservableDaemon').ignoreErrors();
            }
        };

        daemonProc.on('exit', completeHandler);
        daemonProc.on('close', completeHandler);
        result.out.subscribe(noop, completeHandler, completeHandler);

        return result;
    }
    /**
     * Adds a daemon into a pool.
     *
     * @private
     * @param {DaemonType} type
     * @memberof PythonDaemonExecutionServicePool
     */
    private async addDaemonService(type: DaemonType) {
        const daemon = await this.createDaemonServices();
        const pool = type === 'StandardDaemon' ? this.daemons : this.observableDaemons;
        pool.push(daemon);
    }
    /**
     * Gets a daemon from a pool.
     * If we're unable to get a daemon from a pool within 1s, then return the standard `PythonExecutionService`.
     * The `PythonExecutionService` will spanw the required python process and do the needful.
     *
     * @private
     * @returns {Promise<IPythonExecutionService>}
     * @memberof PythonDaemonExecutionServicePool
     */
    private async popDaemonFromPool(): Promise<IPythonExecutionService> {
        if (this.daemons.length > 0) {
            return this.daemons.shift()!;
        }
        // If something is taking longer than 1s, then fall back to using the old execution service.
        const usePythonServiceAsFallback = sleep(1_000).then(() => this.pythonExecutionService);
        const useDaemon = new Promise<IPythonExecutionService>(async resolve => {
            while (this.daemons.length === 0) {
                await sleep(50);
            }
            resolve(this.daemons.shift()!);
        });

        return Promise.race([usePythonServiceAsFallback, useDaemon]);
    }
    /**
     * Gets a daemon from a pool for observable operations.
     * If we're unable to get a daemon from a pool, then return the standard `PythonExecutionService`.
     * The `PythonExecutionService` will spanw the required python process and do the needful.
     *
     * @private
     * @returns {IPythonExecutionService}
     * @memberof PythonDaemonExecutionServicePool
     */
    private popDaemonFromObservablePool(): IPythonExecutionService {
        if (this.observableDaemons.length > 0) {
            return this.observableDaemons.shift()!;
        }
        return this.pythonExecutionService;
    }
    /**
     * Pushes a daemon back into the pool.
     * Before doing this, check whether the daemon is usable or not.
     * If not, then create a new daemon and add it into the pool.
     *
     * @private
     * @param {DaemonType} type
     * @param {IPythonExecutionService} daemon
     * @returns
     * @memberof PythonDaemonExecutionServicePool
     */
    private pushDaemonIntoPool(type: DaemonType, daemon: IPythonExecutionService) {
        if (daemon === this.pythonExecutionService) {
            return;
        }
        // Ensure we test the daemon before we push it back into the pool.
        // Possible it is dead.
        const testAndPushIntoPool = async () => {
            const daemonService = (daemon as PythonDaemonExecutionService);
            let procIsDead = false;
            if (!daemonService.proc.killed && ProcessService.isAlive(daemonService.proc.pid)){
                // Test sending a ping.
                procIsDead = await this.testDaemon(daemonService.connection).then(() => true).catch(() => false);
            }
            if (procIsDead){
                // The process is dead, create a new daemon.
                await this.addDaemonService(type);
                try {
                    daemonService.dispose();
                } catch {
                    noop();
                }
            } else {
                const pool = type === 'StandardDaemon' ? this.daemons : this.observableDaemons;
                pool.push(daemon as IPythonDaemonExecutionService);
            }
        };

        testAndPushIntoPool().ignoreErrors();
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
    private async testDaemon(connection: MessageConnection){
        // If we don't get a reply to the ping in 5 minutes assume it will never work. Bomb out.
        // At this point there should be some information logged in stderr of the daemon process.
        const timeoutedError = sleep(5_000).then(() => Promise.reject(new Error('Timeout waiting for daemon to start')));
        const request = new RequestType<{ data: string }, { pong: string }, void, void>('ping');
        // Check whether the daemon has started correctly, by sending a ping.
        const result = await Promise.race([timeoutedError, connection.sendRequest(request, { data: 'hello' })]);

        if (result.pong !== 'hello') {
            throw new Error(`Daemon did not reply to the ping, received: ${result.pong}`);
        }
    }
    @traceDecorators.error('Failed to create daemon')
    private async createDaemonServices(): Promise<IPythonDaemonExecutionService> {
        const logFileName = `daemon${this.logId += 1}.log`;
        const loggingArgs = ['-v', `--log-file=${path.join(EXTENSION_ROOT_DIR, logFileName)}`];
        const args = (this.options.daemonModule ? [`--daemon-module=${this.options.daemonModule}`] : []).concat(loggingArgs);

        const env = this.envVariables;
        const daemonProc = this.pythonExecutionService!.execModuleObservable('datascience.daemon', args, { env });
        if (!daemonProc.proc) {
            throw new Error('Failed to create Daemon Proc');
        }

        const connection = createMessageConnection(new StreamMessageReader(daemonProc.proc.stdout), new StreamMessageWriter(daemonProc.proc.stdin));
        connection.listen();
        let stdError = '';
        let procEndEx: Error | undefined;
        daemonProc.proc.stderr.on('data', (data: string | Buffer) => {
            data = typeof data === 'string' ? data : data.toString('utf8');
            stdError += data;
        });
        daemonProc.proc.on('error', ex => (procEndEx = ex));

        try {
            await this.testDaemon(connection);

            const cls = this.options.daemonClass ?? PythonDaemonExecutionService;
            const instance = new cls(this.pythonExecutionService, this.pythonPath, daemonProc.proc, connection);
            if (instance instanceof PythonDaemonExecutionService){
                this.disposables.push(instance);
                return instance;
            }
            throw new Error(`Daemon class ${cls.name} must inherit PythonDaemonExecutionService.`);
        } catch (ex) {
            traceError('Failed to start the Daemon, StdErr: ', stdError);
            traceError('Failed to start the Daemon, ProcEndEx', procEndEx || ex);
            traceError('Failed  to start the Daemon, Ex', ex);
            throw ex;
        }
    }
}
