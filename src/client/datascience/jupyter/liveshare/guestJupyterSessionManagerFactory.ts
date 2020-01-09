// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { noop } from '../../../common/utils/misc';
import { IConnection, IJupyterSessionManager, IJupyterSessionManagerFactory } from '../../types';
import { GuestJupyterSessionManager } from './guestJupyterSessionManager';

export class GuestJupyterSessionManagerFactory implements IJupyterSessionManagerFactory {
    public constructor(private realSessionManager: IJupyterSessionManagerFactory) {
        noop();
    }

    public async create(connInfo: IConnection, failOnPassword?: boolean): Promise<IJupyterSessionManager> {
        return new GuestJupyterSessionManager(await this.realSessionManager.create(connInfo, failOnPassword));
    }
}
