// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IServiceContainer } from '../ioc/types';
import { IHistory, IHistoryProvider } from './types';

@injectable()
export class HistoryProvider implements IHistoryProvider {

    private activeHistory : IHistory | undefined;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
    }

    public get active() : IHistory {
        if (!this.activeHistory) {
            this.activeHistory = this.create();
        }

        return this.activeHistory;
    }

    public set active(history : IHistory) {
        this.activeHistory = history;
    }

    public create = () => {
        return this.serviceContainer.get<IHistory>(IHistory);
    }

}
