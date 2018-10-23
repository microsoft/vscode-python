// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import { DebugSession, DebugSessionCustomEvent } from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { sleep } from '../../../common/utils/async';
import { swallowExceptions } from '../../../common/utils/decorators';
import { PTVSDEvents } from './constants';
import { ChildProcessLaunchData, IDebugSessionEventHandlers, IProcessTerminationService } from './types';

/**
 * This class is responsible for handling spawning of new processes for debugging and termination of debugger.
 * We need to kill off any child processes belonging to the parent process that was debugged via a launch.
 * @export
 * @class ProcessTerminationEventHandler
 * @implements {IDebugSessionEventHandlers}
 * @implements {Disposable}
 */
@injectable()
export class ProcessTerminationEventHandler implements IDebugSessionEventHandlers {
    /**
     * List of PID that need to be killed when debugging ends.
     * @protected
     * @memberof ProcessTerminationEventHandler
     */
    protected procecssIdsTrackedToKill = new Set<number>();
    /**
     * Key value pair of the Debug Session ID + corresponding PID that need to be killed.
     * @protected
     * @memberof ProcessTerminationEventHandler
     */
    protected debugSessionsTrackedToKill = new Map<string, number>();
    constructor(@inject(IProcessTerminationService) private readonly processTermination: IProcessTerminationService) { }

    @swallowExceptions('Track processes for termination')
    public async handleCustomEvent(event: DebugSessionCustomEvent): Promise<void> {
        if (!event) {
            return;
        }

        switch (event.event) {
            case PTVSDEvents.ChildProcessLaunched:
                return this.handleSubProcessLaunch(event.body! as ChildProcessLaunchData);
            case PTVSDEvents.ProcessLaunched:
                // tslint:disable-next-line:no-any
                return this.handleProcessLaunch(event as any as DebugProtocol.ProcessEvent, event.session.id);
            default:
                return;
        }
    }
    @swallowExceptions('Terminate debugger processes')
    public async handleTerminateEvent(event: DebugSession): Promise<void> {
        const pid = this.debugSessionsTrackedToKill.get(event.id);
        if (pid) {
            this.processTermination.terminateProcess(pid);
        }
        await this.waitForCleanup();
        this.processTermination.terminateOrphanedProcesses();
    }
    protected async waitForCleanup() {
        // Wait till all house cleaning to take place.
        await sleep(5000);
    }
    protected handleProcessLaunch(event: DebugProtocol.ProcessEvent, debugSessionId: string) {
        if (!event.body.systemProcessId) {
            return;
        }

        switch (event.body.startMethod) {
            case 'launch': {
                this.processTermination.trackProcess(event.body.systemProcessId);
                this.debugSessionsTrackedToKill.set(debugSessionId, event.body.systemProcessId);
                break;
            }
            case 'attach': {
                // Only if attaching to a child process part of a multi process launch debug.
                if (this.procecssIdsTrackedToKill.has(event.body.systemProcessId)) {
                    this.procecssIdsTrackedToKill.delete(event.body.systemProcessId);
                    this.debugSessionsTrackedToKill.set(debugSessionId, event.body.systemProcessId);
                }
            }
            default:
                break;
        }
    }
    protected handleSubProcessLaunch(data: ChildProcessLaunchData) {
        // We need to track root & parent process that is a part of multi-proc `launch` debugging.
        if (!data.rootProcessId || data.rootStartRequest.arguments.request !== 'launch') {
            return;
        }
        this.processTermination.trackProcess(data.processId, data.parentProcessId);
        this.processTermination.trackProcess(data.processId, data.rootProcessId);

        this.procecssIdsTrackedToKill.add(data.processId);
        this.procecssIdsTrackedToKill.add(data.parentProcessId);
        this.procecssIdsTrackedToKill.add(data.rootProcessId);
    }
}
