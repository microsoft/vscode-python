// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IServiceContainer } from '../ioc/types';
import { History } from './history';
import { IHistory, IHistoryProvider } from './types';

@injectable()
export class HistoryProvider implements IHistoryProvider {

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
    }

    public getOrCreateHistory() : Promise<IHistory>{
        return Promise.resolve(History.getOrCreateActive(this.serviceContainer));
    }

}
