// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import { Disposable } from 'vscode';
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
    constructor(@inject(IDisposableRegistry) disposables: Disposable[]) {
        disposables.push(this);
    }
    public dispose = () => this.terminateChildProcesses();
    public trackProcess(pid: number, ancestorPid?: number): void {
        // If we have an ancestor Pid, then track those as well, they'll need to be killed off,
        // and we'll need to kill the child procs when the ancestors die.
        if (ancestorPid) {
            if (this.parentAndChildProcsToKill.has(ancestorPid)) {
                this.parentAndChildProcsToKill.get(ancestorPid)!.add(pid);
            } else {
                this.parentAndChildProcsToKill.set(pid, new Set<number>([ancestorPid, pid]));
            }
        }
        // Track the proc that needs to be killed off (including any of its children).
        if (!this.parentAndChildProcsToKill.has(pid)) {
            this.parentAndChildProcsToKill.set(pid, new Set<number>([pid]));
        }
    }

    public terminateChildProcesses() {
        // tslint:disable-next-line:no-require-imports
        const killProcessTree = require('tree-kill');

        const procIds = this.getDeadAncestorProcessIds();
        const childProcs = _.flatten(procIds.map(procId => {
            if (this.parentAndChildProcsToKill.has(procId)) {
                return Array.from(this.parentAndChildProcsToKill.get(procId)!.values());
            } else {
                return [];
            }
        }));
        // Kill the parent and all tracked child processes.
        [...procIds, ...childProcs].forEach(procId => {
            try {
                this.parentAndChildProcsToKill.delete(procId);
                killProcessTree(procId);
            } catch {
                // Ignore.
            }
        });
    }

    protected getDeadAncestorProcessIds() {
        const deadProcessIds: number[] = [];
        for (const procId of this.parentAndChildProcsToKill.keys()) {
            if (!this.isProcessIdAlive(procId)) {
                deadProcessIds.push(procId);
            }
        }
        return deadProcessIds;
    }
    protected isProcessIdAlive(pid: number) {
        try {
            process.kill(pid, 0);
            return true;
        } catch {
            return false;
        }
    }
}
