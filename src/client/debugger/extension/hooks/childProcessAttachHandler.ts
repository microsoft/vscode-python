// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { DebugSessionCustomEvent } from 'vscode';
import { swallowExceptions } from '../../../common/utils/decorators';
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
    constructor(@inject(IChildProcessAttachService) private readonly childProcessAttachService: IChildProcessAttachService) { }

    @swallowExceptions('Handle child process launch')
    public async handleCustomEvent(event: DebugSessionCustomEvent): Promise<void> {
        if (!event || event.event !== PTVSDEvents.ChildProcessLaunched) {
            return;
        }
        const data = event.body! as ChildProcessLaunchData;
        await this.childProcessAttachService.attach(data, event.session);
    }
}
