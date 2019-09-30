// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { noop } from '../../../../test/core';
import { IConnection, IJupyterSessionManager, IJupyterSessionManagerFactory } from '../../types';
import { GuestJupyterSessionManager } from './guestJupyterSessionManager';

export class GuestJupyterSessionManagerFactory implements IJupyterSessionManagerFactory {

    public constructor(private realSessionManager: IJupyterSessionManagerFactory) {
        noop();
    }

    public async create(connInfo: IConnection): Promise<IJupyterSessionManager> {
        return new GuestJupyterSessionManager(await this.realSessionManager.create(connInfo));
    }

}
