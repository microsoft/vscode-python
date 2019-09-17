// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';

import { IConnection, IJupyterPasswordConnect, IJupyterSessionManager, IJupyterSessionManagerFactory } from '../types';
import { JupyterSessionManager } from './jupyterSessionManager';

@injectable()
export class JupyterSessionManagerFactory implements IJupyterSessionManagerFactory {

    constructor(
        @inject(IJupyterPasswordConnect) private jupyterPasswordConnect: IJupyterPasswordConnect
    ) {
    }

    public async create(connInfo: IConnection): Promise<IJupyterSessionManager> {
        const result = new JupyterSessionManager(this.jupyterPasswordConnect);
        await result.initialize(connInfo);
        return result;
    }
}
