// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';

import { IDisposableRegistry } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { IHistory, IHistoryProvider } from './types';

@injectable()
export class HistoryProvider implements IHistoryProvider {

    private activeHistory : IHistory | undefined;

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry) {
    }

    public get active() : IHistory {
        if (!this.activeHistory || this.activeHistory.isDisposed()) {
            this.activeHistory = this.create();
        }

        return this.activeHistory;
    }

    public set active(history : IHistory) {
        this.activeHistory = history;
    }

    public create = () => {
        const result = this.serviceContainer.get<IHistory>(IHistory);
        this.disposables.push(result);
        return result;
    }

}
