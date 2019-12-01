// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';

import { IConfigurationService } from '../../common/types';
import { IConnection, IJupyterPasswordConnect, IJupyterSessionManager, IJupyterSessionManagerFactory } from '../types';
import { JupyterSessionManager } from './jupyterSessionManager';

@injectable()
export class JupyterSessionManagerFactory implements IJupyterSessionManagerFactory {

    constructor(
        @inject(IJupyterPasswordConnect) private jupyterPasswordConnect: IJupyterPasswordConnect,
        @inject(IConfigurationService) private config: IConfigurationService
    ) {
    }

    /**
     * Creates a new IJupyterSessionManager.
     * @param connInfo - connection information to the server that's already running.
     * @param failOnPassword - whether or not to fail the creation if a password is required.
     */
    public async create(connInfo: IConnection, failOnPassword?: boolean): Promise<IJupyterSessionManager> {
        const result = new JupyterSessionManager(this.jupyterPasswordConnect, this.config, failOnPassword);
        await result.initialize(connInfo);
        return result;
    }
}
