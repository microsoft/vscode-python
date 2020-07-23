// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { Kernel } from '@jupyterlab/services';
import { EventEmitter } from 'vscode';
import { noop } from '../../../common/utils/misc';
import { IJupyterConnection, IJupyterSessionManager, IJupyterSessionManagerFactory } from '../../types';
import { GuestJupyterSessionManager } from './guestJupyterSessionManager';

export class GuestJupyterSessionManagerFactory implements IJupyterSessionManagerFactory {
    private restartSessionCreatedEvent = new EventEmitter<Kernel.IKernelConnection>();
    private restartSessionUsedEvent = new EventEmitter<Kernel.IKernelConnection>();
    public constructor(private realSessionManager: IJupyterSessionManagerFactory) {
        noop();
    }

    public async create(connInfo: IJupyterConnection, failOnPassword?: boolean): Promise<IJupyterSessionManager> {
        return new GuestJupyterSessionManager(await this.realSessionManager.create(connInfo, failOnPassword));
    }

    public get onRestartSessionCreated() {
        return this.restartSessionCreatedEvent.event;
    }

    public get onRestartSessionUsed() {
        return this.restartSessionUsedEvent.event;
    }
}
