// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';

import { IServiceContainer } from '../../ioc/types';
import {
    IJupyterVariable,
    IJupyterVariableDataProvider,
    IJupyterVariableDataProviderFactory,
    INotebook
} from '../types';

@injectable()
export class JupyterVariableDataProviderFactory implements IJupyterVariableDataProviderFactory {
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {}

    public async create(variable: IJupyterVariable, notebook: INotebook): Promise<IJupyterVariableDataProvider> {
        const jupyterVariableDataProvider = this.serviceContainer.get<IJupyterVariableDataProvider>(
            IJupyterVariableDataProvider
        );
        jupyterVariableDataProvider.setDependencies(variable, notebook);
        return jupyterVariableDataProvider;
    }
}
