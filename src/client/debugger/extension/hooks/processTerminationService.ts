// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import { Disposable } from 'vscode';
import { IDebugService } from '../../../common/application/types';
import { ProcessService } from '../../../common/process/proc';
import { IDisposableRegistry } from '../../../common/types';
import { IProcessTerminationService } from './types';
/**
 * Keeps track of processes and child proceses that are being debugged (via a launc), which
 * will need to be killed off when the debugger stops.
 * @export
 * @class ProcessTerminationEventHandler
 * @implements {ProcessTerminationService}
 * @implements {Disposable}
 */
@injectable()
export class ProcessTerminationService implements IProcessTerminationService {
    protected parentAndChildProcsToKill = new Map<number, Set<number>>();
    protected initialized = false;
    constructor(@inject(IDisposableRegistry) disposables: Disposable[]) {
        disposables.push(this);
    }
    public dispose = () => this.terminateTrackedProcesses();
    public trackProcess(pid: number, ancestorPid?: number): void {
        // If we have an ancestor Pid, then track those as well, they'll need to be killed off,
        // and we'll need to kill the child procs when the ancestors die.
        if (ancestorPid) {
            if (this.parentAndChildProcsToKill.has(ancestorPid)) {
                this.parentAndChildProcsToKill.get(ancestorPid)!.add(pid);
            } else {
                this.parentAndChildProcsToKill.set(ancestorPid, new Set<number>([ancestorPid, pid]));
            }
        }
        // Track the proc that needs to be killed off (including any of its children).
        if (!this.parentAndChildProcsToKill.has(pid)) {
            this.parentAndChildProcsToKill.set(pid, new Set<number>([pid]));
        }
    }
    public terminateProcess(pid: number): void {
        ProcessService.kill(pid);
        this.terminateProcesses(pid);
    }
    public terminateTrackedProcesses(): void {
        for (const kv of this.parentAndChildProcsToKill) {
            for (const childProcIds of kv[1].values()) {
                try {
                    ProcessService.kill(childProcIds);
                } catch {
                    // Ignore.
                }
            }
        }
        this.parentAndChildProcsToKill.clear();
    }
    public terminateOrphanedProcesses() {
        this.terminateProcesses();
    }

    public terminateProcesses(parentPid?: number) {

        const parentProcId = parentPid ? [parentPid] : [];
        const procIds = [...this.getDeadProcessIds(), ...parentProcId];
        const childProcIds = _.flatten(procIds.map(item => this.getAllChildProcs(item)));
        // Kill the parent and all tracked child processes.
        [...procIds, ...childProcIds].forEach(procId => {
            try {
                this.parentAndChildProcsToKill.delete(procId);
                ProcessService.kill(procId);
            } catch {
                // Ignore.
            }
        });
    }

    protected getDeadProcessIds() {
        return Array.from(this.parentAndChildProcsToKill.keys())
            .filter(pid => !ProcessService.isAlive(pid));
    }
    protected getAllChildProcs(parentPid: number) {
        const childProcIds: number[] = [];
        for (const kv of this.parentAndChildProcsToKill) {
            if (kv[0] !== parentPid) {
                continue;
            }
            const values = Array.from(kv[1].values());
            childProcIds.push(...values.filter(pid => pid !== parentPid));
        }
        const grandChildren = _.flatten(childProcIds.map(pid => this.getAllChildProcs(pid)));
        return [...childProcIds, ...grandChildren];
    }
}
