// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { DebugConfiguration, DebugSessionCustomEvent } from 'vscode';
import { swallowExceptions } from '../../../common/utils/decorators';
import { AttachRequestArguments } from '../../types';
import { PTVSDEvents } from './constants';
import { ChildProcessLaunchData, IChildProcessAttachService, IDebugSessionEventHandlers } from './types';

/**
 * This class is responsible for automatically attaching the debugger to any
 * child processes launched. I.e. this is the classs responsible for multi-proc debugging.
 * @export
 * @class ChildProcessAttachEventHandler
 * @implements {IDebugSessionEventHandlers}
 */
@injectable()
export class ChildProcessAttachEventHandler implements IDebugSessionEventHandlers {
    constructor(@inject(IChildProcessAttachService) private readonly childProcessAttachService: IChildProcessAttachService) {}

    @swallowExceptions('Handle child process launch')
    public async handleCustomEvent(event: DebugSessionCustomEvent): Promise<void> {
        if (!event || (event.event !== PTVSDEvents.ChildProcessLaunched && event.event !== PTVSDEvents.AttachToSubprocess)) {
            return;
        }
        let data: ChildProcessLaunchData | (AttachRequestArguments & DebugConfiguration);
        if (event.event === PTVSDEvents.ChildProcessLaunched) {
            data = event.body! as ChildProcessLaunchData;
            await this.childProcessAttachService.attach(data, event.session);
        } else {
            data = event.body! as (AttachRequestArguments & DebugConfiguration);
        }
        await this.childProcessAttachService.attach(data, event.session);
    }
}
