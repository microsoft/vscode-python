// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Subject } from 'rxjs/Subject';
import { sleep } from '../utils/async';
import { noop } from '../utils/misc';
import { ExecutionResult, InterpreterInfomation, IPythonDaemonExecutionService, IPythonExecutionService, ObservableExecutionResult, Output, SpawnOptions } from './types';

export class PythonDaemonExecutionServicePool implements IPythonDaemonExecutionService {
    private pool: IPythonExecutionService[] = [];
    constructor(daemons: IPythonDaemonExecutionService[], private readonly pythonExecutionService: IPythonExecutionService) {
        this.pool.push(...daemons);
    }
    public dispose() {
        this.pool.forEach(item => (item as IPythonDaemonExecutionService).dispose());
    }
    public async popDaemonFromPool(): Promise<IPythonExecutionService> {
        if (this.pool.length > 0) {
            return this.pool.shift()!;
        }
        // If something is taking longer than 1s, then fall back to using the old execution service.
        const usePythonServiceAsFallback = sleep(1_000).then(() => this.pythonExecutionService);
        const useDaemon = new Promise<IPythonExecutionService>(async resolve => {
            while (this.pool.length === 0) {
                await sleep(50);
            }
            resolve(this.pool.shift()!);
        });

        return Promise.race([usePythonServiceAsFallback, useDaemon]);
    }
    public pushDaemonIntoPool(daemon: IPythonExecutionService) {
        if (daemon === this.pythonExecutionService) {
            return;
        }
        this.pool.push(daemon);
    }
    public async getInterpreterInformation(): Promise<InterpreterInfomation | undefined> {
        const daemon = await this.popDaemonFromPool();
        return daemon.getInterpreterInformation().finally(() => this.pushDaemonIntoPool(daemon));
    }
    public async getExecutablePath(): Promise<string> {
        const daemon = await this.popDaemonFromPool();
        return daemon.getExecutablePath().finally(() => this.pushDaemonIntoPool(daemon));
    }
    public async isModuleInstalled(moduleName: string): Promise<boolean> {
        const daemon = await this.popDaemonFromPool();
        return daemon.isModuleInstalled(moduleName).finally(() => this.pushDaemonIntoPool(daemon));
    }
    public async exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        const daemon = await this.popDaemonFromPool();
        return daemon.exec(args, options).finally(() => this.pushDaemonIntoPool(daemon));
    }
    public async execModule(moduleName: string, args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        const daemon = await this.popDaemonFromPool();
        return daemon.execModule(moduleName, args, options).finally(() => this.pushDaemonIntoPool(daemon));
    }
    /**
     * Basically, return an observable that can be listened to.
     * But start pushing data into the subject (observer) only when we have a daemon and method has been invoked.
     *
     * @param {string[]} args
     * @param {SpawnOptions} options
     * @returns {ObservableExecutionResult<string>}
     * @memberof PythonDaemonExecutionServicePool
     */
    public execObservable(args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        const subject = new Subject<Output<string>>();
        const start = async () => {
            const daemon = await this.popDaemonFromPool();
            try {
                const out = daemon.execObservable(args, options).out;
                out.subscribe(subject);
                out.subscribe(noop, () => this.pushDaemonIntoPool(daemon), () => this.pushDaemonIntoPool(daemon));
            } catch {
                this.pushDaemonIntoPool(daemon);
            }
        };
        start().ignoreErrors();
        return {
            dispose: noop,
            out: subject,
            proc: undefined
        };
    }
    public execModuleObservable(moduleName: string, args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        const subject = new Subject<Output<string>>();
        const start = async () => {
            const daemon = await this.popDaemonFromPool();
            try {
                const out = daemon.execModuleObservable(moduleName, args, options).out;
                out.subscribe(subject);
                out.subscribe(noop, () => this.pushDaemonIntoPool(daemon), () => this.pushDaemonIntoPool(daemon));
            } catch {
                this.pushDaemonIntoPool(daemon);
            }
        };
        start().ignoreErrors();
        return {
            dispose: noop,
            out: subject,
            proc: undefined
        };
    }
}
