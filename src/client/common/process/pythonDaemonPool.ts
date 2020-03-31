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
} from 'vscode-jsonrpc';

import { EXTENSION_ROOT_DIR } from '../../constants';
import { PYTHON_WARNINGS } from '../constants';
import { traceDecorators, traceError } from '../logger';
import { IDisposableRegistry } from '../types';
import { createDeferred, sleep } from '../utils/async';
import { noop } from '../utils/misc';
import { StopWatch } from '../utils/stopWatch';
import * as internalPython from './internal/python';
import { ProcessService } from './proc';
import { PythonDaemonExecutionService } from './pythonDaemon';
import {
    DaemonExecutionFactoryCreationOptions,
    ExecutionResult,
    InterpreterInfomation,
    IProcessLogger,
    IPythonDaemonExecutionService,
    IPythonExecutionService,
    ObservableExecutionResult,
    PythonExecutionInfo,
    SpawnOptions
} from './types';

type DaemonType = 'StandardDaemon' | 'ObservableDaemon';

export class PythonDaemonExecutionServicePool implements IPythonDaemonExecutionService {
    private readonly daemons: IPythonDaemonExecutionService[] = [];
    private readonly observableDaemons: IPythonDaemonExecutionService[] = [];
    private readonly envVariables: NodeJS.ProcessEnv;
    private readonly pythonPath: string;
    private _disposed = false;
    constructor(
        private readonly logger: IProcessLogger,
        private readonly disposables: IDisposableRegistry,
        private readonly options: DaemonExecutionFactoryCreationOptions,
        private readonly pythonExecutionService: IPythonExecutionService,
        private readonly activatedEnvVariables?: NodeJS.ProcessEnv,
        private readonly timeoutWaitingForDaemon: number = 1_000
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
        this.disposables.push(this);
    }
    public async initialize() {
        const promises = Promise.all(
            [
                // tslint:disable-next-line: prefer-array-literal
                ...new Array(this.options.daemonCount ?? 2).keys()
            ].map(() => this.addDaemonService('StandardDaemon'))
        );
        const promises2 = Promise.all(
            [
                // tslint:disable-next-line: prefer-array-literal
                ...new Array(this.options.observableDaemonCount ?? 1).keys()
            ].map(() => this.addDaemonService('ObservableDaemon'))
        );

        await Promise.all([promises, promises2]);
    }
    public dispose() {
        this._disposed = true;
    }
    public async getInterpreterInformation(): Promise<InterpreterInfomation | undefined> {
        const msg = { args: ['GetPythonVersion'] };
        return this.wrapCall((daemon) => daemon.getInterpreterInformation(), msg);
    }
    public async getExecutablePath(): Promise<string> {
        const msg = { args: ['getExecutablePath'] };
        return this.wrapCall((daemon) => daemon.getExecutablePath(), msg);
    }
    public getExecutionInfo(pythonArgs?: string[]): PythonExecutionInfo {
        return this.pythonExecutionService.getExecutionInfo(pythonArgs);
    }
    public async isModuleInstalled(moduleName: string): Promise<boolean> {
        const args = internalPython.execModule(moduleName, []);
        const msg = { args };
        return this.wrapCall((daemon) => daemon.isModuleInstalled(moduleName), msg);
    }
    public async exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        const msg = { args, options };
        return this.wrapCall((daemon) => daemon.exec(args, options), msg);
    }
    public async execModule(
        moduleName: string,
        moduleArgs: string[],
        options: SpawnOptions
    ): Promise<ExecutionResult<string>> {
        const args = internalPython.execModule(moduleName, moduleArgs);
        const msg = { args, options };
        return this.wrapCall((daemon) => daemon.execModule(moduleName, args, options), msg);
    }
    public execObservable(args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        const msg = { args, options };
        return this.wrapObservableCall((daemon) => daemon.execObservable(args, options), msg);
    }
    public execModuleObservable(
        moduleName: string,
        moduleArgs: string[],
        options: SpawnOptions
    ): ObservableExecutionResult<string> {
        const args = internalPython.execModule(moduleName, moduleArgs);
        const msg = { args, options };
        return this.wrapObservableCall((daemon) => daemon.execModuleObservable(moduleName, args, options), msg);
    }
    /**
     * Protected so we can override for testing purposes.
     *
     * @protected
     * @param {ChildProcess} proc
     * @returns
     * @memberof PythonDaemonExecutionServicePool
     */
    protected createConnection(proc: ChildProcess) {
        return createMessageConnection(new StreamMessageReader(proc.stdout), new StreamMessageWriter(proc.stdin));
    }
    @traceDecorators.error('Failed to create daemon')
    protected async createDaemonServices(): Promise<IPythonDaemonExecutionService> {
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
            const instance = new cls(this.pythonExecutionService, this.pythonPath, daemonProc.proc, connection);
            if (instance instanceof PythonDaemonExecutionService) {
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
    private async wrapCall<T>(
        cb: (daemon: IPythonExecutionService) => Promise<T>,
        daemonLogMessage: { args: string[]; options?: SpawnOptions }
    ): Promise<T> {
        const daemon = await this.popDaemonFromPool();
        try {
            // When using the daemon, log the message ourselves.
            if (daemon instanceof PythonDaemonExecutionService) {
                this.logger.logProcess(`${this.pythonPath} (daemon)`, daemonLogMessage.args, daemonLogMessage.options);
            }
            return await cb(daemon);
        } finally {
            this.pushDaemonIntoPool('StandardDaemon', daemon);
        }
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
    private wrapObservableCall(
        cb: (daemon: IPythonExecutionService) => ObservableExecutionResult<string>,
        daemonLogMessage: { args: string[]; options?: SpawnOptions }
    ): ObservableExecutionResult<string> {
        const execService = this.popDaemonFromObservablePool();
        // Possible the daemon returned is a standard python execution service.
        const daemonProc = execService instanceof PythonDaemonExecutionService ? execService.proc : undefined;

        // When using the daemon, log the message ourselves.
        if (daemonProc) {
            this.logger.logProcess(`${this.pythonPath} (daemon)`, daemonLogMessage.args, daemonLogMessage.options);
        }
        const result = cb(execService);
        let completed = false;
        const completeHandler = () => {
            if (completed) {
                return;
            }
            completed = true;
            if (!daemonProc || (!daemonProc.killed && ProcessService.isAlive(daemonProc.pid))) {
                this.pushDaemonIntoPool('ObservableDaemon', execService);
            } else if (!this._disposed) {
                // Possible daemon is dead (explicitly killed or died due to some error).
                this.addDaemonService('ObservableDaemon').ignoreErrors();
            }
        };

        if (daemonProc) {
            daemonProc.on('exit', completeHandler);
            daemonProc.on('close', completeHandler);
        }
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
        const stopWatch = new StopWatch();
        while (this.daemons.length === 0 && stopWatch.elapsedTime <= this.timeoutWaitingForDaemon) {
            await sleep(50);
        }
        return this.daemons.shift() ?? this.pythonExecutionService;
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
            const daemonService = daemon as PythonDaemonExecutionService;
            let procIsDead = false;
            if (
                !daemonService.isAlive ||
                daemonService.proc.killed ||
                !ProcessService.isAlive(daemonService.proc.pid)
            ) {
                procIsDead = true;
            } else {
                // Test sending a ping.
                procIsDead = await this.testDaemon(daemonService.connection)
                    .then(() => false)
                    .catch(() => true);
            }
            if (procIsDead) {
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
    private async testDaemon(connection: MessageConnection) {
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
