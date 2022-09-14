// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { EventEmitter } from 'events';
import { traceError } from '../../logging';

import { IDisposable } from '../types';
import { EnvironmentVariables } from '../variables/types';
import { execObservable, killPid, plainExec, shellExec } from './rawProcessApis';
import { ExecutionResult, IProcessService, ObservableExecutionResult, ShellOptions, SpawnOptions } from './types';

export class ProcessService extends EventEmitter implements IProcessService {
    private processesToKill = new Set<IDisposable>();

    constructor(private readonly env?: EnvironmentVariables) {
        super();
    }

    public static isAlive(pid: number): boolean {
        try {
            process.kill(pid, 0);
            return true;
        } catch {
            return false;
        }
    }

    public static kill(pid: number): void {
        killPid(pid);
    }

    public dispose(): void {
        this.removeAllListeners();
        this.processesToKill.forEach((p) => {
            try {
                p.dispose();
            } catch {
                // ignore.
            }
        });
    }

    public execObservable(file: string, args: string[], options: SpawnOptions = {}): ObservableExecutionResult<string> {
        const result = execObservable(file, args, options, this.env, this.processesToKill);
        this.emit('exec', file, args, options);
        return result;
    }

    public exec(file: string, args: string[], options: SpawnOptions = {}): Promise<ExecutionResult<string>> {
        const promise = plainExec(file, args, options, this.env, this.processesToKill);
        this.emit('exec', file, args, options);
        return promise;
    }

    public shellExec(command: string, options: ShellOptions = {}): Promise<ExecutionResult<string>> {
        this.emit('exec', command, undefined, options);
        const disposables = new Set<IDisposable>();
        return shellExec(command, options, this.env, disposables).finally(() => {
            // Ensure the process we started is cleaned up.
            disposables.forEach((p) => {
                try {
                    p.dispose();
                } catch {
                    traceError(`Unable to kill process for ${command}`);
                }
            });
        });
    }
}
