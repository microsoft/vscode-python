// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { Event, EventEmitter } from 'vscode';
import * as vsls from 'vsls/vscode';

import { createDeferred, Deferred } from '../../common/utils/async';
import { LiveShare } from '../constants';
import { IJupyterExecutionFactory, IJupyterExecution } from '../types';
import { IServiceContainer } from '../../ioc/types';

@injectable()
export class JupyterExecutionFactory implements IJupyterExecutionFactory {

    private apiPromise: Deferred<vsls.LiveShare | undefined> = createDeferred<vsls.LiveShare | undefined>();
    private executeChangedEmitter : EventEmitter<void> = new EventEmitter<void>();

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        vsls.getApiAsync().then(
            v => this.register(v),
            r => this.apiPromise.reject(r)
        );
    }

    public get executionChanged() : Event<void> {
        return this.executeChangedEmitter.event;
    }
    public async create(): Promise<IJupyterExecution> {
        const api = await this.apiPromise.promise;
        if (api) {
            if (api.session && api.session.role === vsls.Role.Host) {
                return this.serviceContainer.get<IJupyterExecution>(IJupyterExecution, LiveShare.Host);
            } else if (api.session && api.session.role === vsls.Role.Guest) {
                return this.serviceContainer.get<IJupyterExecution>(IJupyterExecution, LiveShare.Guest);
            }
        }

        return this.serviceContainer.get<IJupyterExecution>(IJupyterExecution)
    }

    private register(api: vsls.LiveShare) {
        api.onDidChangeSession(() => this.executeChangedEmitter.fire());
        this.apiPromise.resolve(api);
    }


}
