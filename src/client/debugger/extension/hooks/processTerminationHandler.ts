// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import { DebugSession, DebugSessionCustomEvent, Disposable } from 'vscode';
import { IDisposableRegistry } from '../../../common/types';
import { sleep } from '../../../common/utils/async';
import { swallowExceptions } from '../../../common/utils/decorators';
import { noop } from '../../../common/utils/misc';
import { ChildProcessLaunched } from './constants';
import { ChildProcessLaunchData, IDebugSessionEventHandlers } from './types';

/**
 * This class is responsible for killing any processes that didn't die after the debugger ends.
 * Child processes belonging to a parent process that is no longer being debugged (via launch) will be killed off.
 * @export
 * @class ProcecssTerminationEventHandler
 * @implements {IDebugSessionEventHandlers}
 * @implements {Disposable}
 */
@injectable()
export class ProcecssTerminationEventHandler implements IDebugSessionEventHandlers, Disposable {
    protected parentAndChildProcsToKill = new Map<number, Set<number>>();
    constructor(@inject(IDisposableRegistry) disposables: Disposable[]) {
        disposables.push(this);
    }
    public dispose = () => this.killDeadProccesses();

    @swallowExceptions('Track child process for termination')
    public async handleCustomEvent(event: DebugSessionCustomEvent): Promise<void> {
        if (!event || event.event !== ChildProcessLaunched) {
            return;
        }
        const data = event.body! as ChildProcessLaunchData;

        // Track the parent process that was launched via debugger and subsequently launched child procs.
        if (data.initialProcessId && data.initialProcessId === data.parentProcessId &&
            data.rootStartRequest.arguments.request === 'launch' &&
            !this.parentAndChildProcsToKill.has(data.initialProcessId)) {
            const procIds = new Set<number>();
            procIds.add(data.initialProcessId);
            procIds.add(data.processId);
            this.parentAndChildProcsToKill.set(data.initialProcessId, procIds);
        }

        // Look for a child process that has been launched as a child/grandchild of a parent process
        // that was launched via debugger locally.
        if (this.parentAndChildProcsToKill.has(data.initialProcessId)) {
            this.parentAndChildProcsToKill.get(data.initialProcessId)!.add(data.processId);

            // Keep track of the child processes that need to be killed (if we just detach from child proc).
            this.parentAndChildProcsToKill.set(data.processId, new Set<number>([data.processId]));
        }
    }
    @swallowExceptions('Terminate debugger processes')
    public async handleTerminateEvent(event: DebugSession): Promise<void> {
        // Wait till all house cleaning to take place.
        await sleep(5000);
        this.killDeadProccesses();
    }
    protected killDeadProccesses() {
        // tslint:disable-next-line:no-require-imports
        const killProcessTree = require('tree-kill');

        const procIds = this.getDeadParentProcessIds();
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
                noop();
            }
        });

    }
    protected getDeadParentProcessIds() {
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
