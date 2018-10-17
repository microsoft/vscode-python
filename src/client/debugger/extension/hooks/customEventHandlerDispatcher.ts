// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, multiInject } from 'inversify';
import { IDebugService } from '../../../common/application/types';
import { IDisposableRegistry } from '../../../common/types';
import { ICustomDebugSessionEventHandlers } from './types';

export class CustomDebugSessionEventDispatcher {
    constructor(@multiInject(ICustomDebugSessionEventHandlers) private readonly eventHandlers: ICustomDebugSessionEventHandlers[],
        @inject(IDebugService) private readonly debugService: IDebugService,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry) { }
    public registerEventHandlers() {
        this.disposables.push(this.debugService.onDidReceiveDebugSessionCustomEvent(e => {
            this.eventHandlers.forEach(handler => handler.handleEvent(e).ignoreErrors());
        }));
    }
}
