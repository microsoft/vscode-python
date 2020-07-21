// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable, named } from 'inversify';
import { IApplicationShell } from '../../common/application/types';

import { IConfigurationService, IOutputChannel, IPersistentStateFactory } from '../../common/types';
import { JUPYTER_OUTPUT_CHANNEL } from '../constants';
import {
    IJupyterConnection,
    IJupyterPasswordConnect,
    IJupyterSessionManager,
    IJupyterSessionManagerFactory
} from '../types';
import { JupyterSessionManager } from './jupyterSessionManager';
import { KernelSelector } from './kernels/kernelSelector';

@injectable()
export class JupyterSessionManagerFactory implements IJupyterSessionManagerFactory {
    constructor(
        @inject(IJupyterPasswordConnect) private jupyterPasswordConnect: IJupyterPasswordConnect,
        @inject(IConfigurationService) private config: IConfigurationService,
        @inject(KernelSelector) private kernelSelector: KernelSelector,
        @inject(IOutputChannel) @named(JUPYTER_OUTPUT_CHANNEL) private jupyterOutput: IOutputChannel,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IPersistentStateFactory) private readonly stateFactory: IPersistentStateFactory
    ) {}

    /**
     * Creates a new IJupyterSessionManager.
     * @param connInfo - connection information to the server that's already running.
     * @param failOnPassword - whether or not to fail the creation if a password is required.
     */
    public async create(connInfo: IJupyterConnection, failOnPassword?: boolean): Promise<IJupyterSessionManager> {
        const result = new JupyterSessionManager(
            this.jupyterPasswordConnect,
            this.config,
            failOnPassword,
            this.kernelSelector,
            this.jupyterOutput,
            this.config,
            this.appShell,
            this.stateFactory
        );
        await result.initialize(connInfo);
        return result;
    }
}
