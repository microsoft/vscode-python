// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';

import { IAsyncDisposable, IAsyncDisposableRegistry } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { IDataExplorer, IDataExplorerProvider, IDataExplorerRow } from '../types';

@injectable()
export class DataExplorerProvider implements IDataExplorerProvider, IAsyncDisposable {

    private activeExplorers: IDataExplorer[] = [];
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry : IAsyncDisposableRegistry
        ) {
        asyncRegistry.push(this);
    }

    public async dispose() {
        await Promise.all(this.activeExplorers.map(d => d.dispose()));
    }

    public async create(rows: IDataExplorerRow[]) : Promise<IDataExplorer>{
        const dataExplorer = this.serviceContainer.get<IDataExplorer>(IDataExplorer);
        this.activeExplorers.push(dataExplorer);
        await dataExplorer.show(rows);
        return dataExplorer;
    }
}
