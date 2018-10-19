// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import { DebugSession, DebugSessionCustomEvent } from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { sleep } from '../../../common/utils/async';
import { swallowExceptions } from '../../../common/utils/decorators';
import { ChildProcessLaunched, ProcessLaunched } from './constants';
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
    protected parentAndChildProcsToKill = new Map<number, Set<number>>();
    constructor(@inject(IProcessTerminationService) private readonly processTermination: IProcessTerminationService) { }

    @swallowExceptions('Track child process for termination')
    public async handleCustomEvent(event: DebugSessionCustomEvent): Promise<void> {
        if (!event) {
            return;
        }

        switch (event.event) {
            case ChildProcessLaunched:
                return this.handleSubProcessLaunch(event.body! as ChildProcessLaunchData);
            case ProcessLaunched:
                // tslint:disable-next-line:no-any
                return this.handleProcessLaunch(event as any as DebugProtocol.ProcessEvent);
            default:
                return;
        }
    }
    @swallowExceptions('Terminate debugger processes')
    public async handleTerminateEvent(event: DebugSession): Promise<void> {
        // Wait till all house cleaning to take place.
        await sleep(5000);
        this.processTermination.terminateChildProcesses();
    }
    protected handleProcessLaunch(event: DebugProtocol.ProcessEvent) {
        if (event.body.startMethod !== 'launch' || !event.body.systemProcessId) {
            return;
        }

        this.processTermination.trackProcess(event.body.systemProcessId);
    }
    protected handleSubProcessLaunch(data: ChildProcessLaunchData) {
        // We need to track root & parent process that is a part of multi-proc `launch` debugging.
        if (!data.initialProcessId || data.rootStartRequest.arguments.request !== 'launch') {
            return;
        }
        this.processTermination.trackProcess(data.processId, data.parentProcessId);
        this.processTermination.trackProcess(data.processId, data.initialProcessId);
    }
}
