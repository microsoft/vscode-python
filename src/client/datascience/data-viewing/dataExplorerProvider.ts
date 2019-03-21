// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';
import * as localize from '../../common/utils/localize';

import { inject, injectable } from 'inversify';

import { IAsyncDisposable, IAsyncDisposableRegistry } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { IDataExplorer, IDataExplorerProvider, IJupyterVariables } from '../types';

@injectable()
export class DataExplorerProvider implements IDataExplorerProvider, IAsyncDisposable {

    private activeExplorers: IDataExplorer[] = [];
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry : IAsyncDisposableRegistry,
        @inject(IJupyterVariables) private variables: IJupyterVariables,
        ) {
        asyncRegistry.push(this);
    }

    public async dispose() {
        await Promise.all(this.activeExplorers.map(d => d.dispose()));
    }

    public async create(variable: string) : Promise<IDataExplorer>{
        // Make sure this is a valid variable
        const variables = await this.variables.getVariables();
        const index = variables.findIndex(v => v && v.name === variable);
        if (index >= 0) {
            const dataExplorer = this.serviceContainer.get<IDataExplorer>(IDataExplorer);
            this.activeExplorers.push(dataExplorer);
            await dataExplorer.show(variables[index]);
            return dataExplorer;
        }

        throw new Error(localize.DataScience.dataExplorerInvalidVariableFormat().format(variable));
    }
}
