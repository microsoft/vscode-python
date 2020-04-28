// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IDisposableRegistry } from '../types';
import { sleep } from '../utils/async';
import { noop } from '../utils/misc';
import { StopWatch } from '../utils/stopWatch';
import { ProcessService } from './proc';
import { PythonDaemonExecutionService } from './pythonDaemon';
import { PythonDaemonFactory } from './pythonDaemonFactory';
import {
    ExecutionResult,
    InterpreterInfomation,
    IProcessLogger,
    IPythonDaemonExecutionService,
    IPythonExecutionService,
    isDaemonPoolCreationOption,
    ObservableExecutionResult,
    PooledDaemonExecutionFactoryCreationOptions,
    PythonExecutionInfo,
    SpawnOptions
} from './types';

type DaemonType = 'StandardDaemon' | 'ObservableDaemon';

export class PythonDaemonExecutionServicePool extends PythonDaemonFactory implements IPythonDaemonExecutionService {
    private readonly daemons: IPythonDaemonExecutionService[] = [];
    private readonly observableDaemons: IPythonDaemonExecutionService[] = [];
    private _disposed = false;
    constructor(
        private readonly logger: IProcessLogger,
        disposables: IDisposableRegistry,
        options: PooledDaemonExecutionFactoryCreationOptions,
        pythonExecutionService: IPythonExecutionService,
        activatedEnvVariables?: NodeJS.ProcessEnv,
        private readonly timeoutWaitingForDaemon: number = 1_000
    ) {
        super(disposables, options, pythonExecutionService, activatedEnvVariables);
        this.disposables.push(this);
    }
    public async initialize() {
        if (!isDaemonPoolCreationOption(this.options)) {
            return;
        }
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
        const msg = { args: ['-m', moduleName] };
        return this.wrapCall((daemon) => daemon.isModuleInstalled(moduleName), msg);
    }
    public async exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        const msg = { args, options };
        return this.wrapCall((daemon) => daemon.exec(args, options), msg);
    }
    public async execModule(
        moduleName: string,
        args: string[],
        options: SpawnOptions
    ): Promise<ExecutionResult<string>> {
        const msg = { args: ['-m', moduleName].concat(args), options };
        return this.wrapCall((daemon) => daemon.execModule(moduleName, args, options), msg);
    }
    public execObservable(args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        const msg = { args, options };
        return this.wrapObservableCall((daemon) => daemon.execObservable(args, options), msg);
    }
    public execModuleObservable(
        moduleName: string,
        args: string[],
        options: SpawnOptions
    ): ObservableExecutionResult<string> {
        const msg = { args: ['-m', moduleName].concat(args), options };
        return this.wrapObservableCall((daemon) => daemon.execModuleObservable(moduleName, args, options), msg);
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
        const daemon = await this.createDaemonService<IPythonDaemonExecutionService>();
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
}
