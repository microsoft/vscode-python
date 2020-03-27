// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Observable } from 'rxjs/Observable';

import { Cancellation, CancellationError } from '../../client/common/cancellation';
import {
    ExecutionResult,
    IProcessService,
    ObservableExecutionResult,
    Output,
    ShellOptions,
    SpawnOptions,
} from '../../client/common/process/types';
import { noop, sleep } from '../core';

export class MockProcessService implements IProcessService {
    private execResults: { file: string; args: (string | RegExp)[]; result(): Promise<ExecutionResult<string>> }[] = [];
    private execObservableResults: {
        file: string;
        args: (string | RegExp)[];
        result(): ObservableExecutionResult<string>;
    }[] = [];
    private timeDelay: number | undefined;

    public execObservable(file: string, args: string[], _options: SpawnOptions): ObservableExecutionResult<string> {
        const match = this.execObservableResults.find((f) => this.argsMatch(f.args, args) && f.file === file);
        if (match) {
            return match.result();
        }

        return this.defaultObservable([file, ...args]);
    }

    public async exec(file: string, args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        const match = this.execResults.find((f) => this.argsMatch(f.args, args) && f.file === file);
        if (match) {
            // Might need a delay before executing to mimic it taking a while.
            if (this.timeDelay) {
                try {
                    const localTime = this.timeDelay;
                    await Cancellation.race((_t) => sleep(localTime), options.token);
                } catch (exc) {
                    if (exc instanceof CancellationError) {
                        return this.defaultExecutionResult([file, ...args]);
                    }
                }
            }
            return match.result();
        }

        return this.defaultExecutionResult([file, ...args]);
    }

    public shellExec(command: string, _options: ShellOptions): Promise<ExecutionResult<string>> {
        // Not supported
        return this.defaultExecutionResult([command]);
    }

    public addExecResult(file: string, args: (string | RegExp)[], result: () => Promise<ExecutionResult<string>>) {
        this.execResults.splice(0, 0, { file: file, args: args, result: result });
    }

    public addExecObservableResult(
        file: string,
        args: (string | RegExp)[],
        result: () => ObservableExecutionResult<string>
    ) {
        this.execObservableResults.splice(0, 0, { file: file, args: args, result: result });
    }

    public setDelay(timeout: number | undefined) {
        this.timeDelay = timeout;
    }

    public on() {
        return this;
    }

    public dispose() {
        return;
    }

    private argsMatch(matchers: (string | RegExp)[], args: string[]): boolean {
        if (matchers.length === args.length) {
            return args.every((s, i) => {
                const r = matchers[i] as RegExp;
                return r && r.test ? r.test(s) : s === matchers[i];
            });
        }
        return false;
    }

    private defaultObservable(args: string[]): ObservableExecutionResult<string> {
        const output = new Observable<Output<string>>((subscriber) => {
            subscriber.next({ out: `Invalid call to ${args.join(' ')}`, source: 'stderr' });
        });
        return {
            proc: undefined,
            out: output,
            dispose: () => noop,
        };
    }

    private defaultExecutionResult(args: string[]): Promise<ExecutionResult<string>> {
        return Promise.resolve({ stderr: `Invalid call to ${args.join(' ')}`, stdout: '' });
    }
}
