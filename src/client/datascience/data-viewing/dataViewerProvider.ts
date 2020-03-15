// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';

import { IAsyncDisposable, IAsyncDisposableRegistry } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { IDataViewer, IDataViewerProvider, IJupyterVariable, INotebook } from '../types';
import { DataViewerDependencyService } from './dataViewerDependencyService';

@injectable()
export class DataViewerProvider implements IDataViewerProvider, IAsyncDisposable {
    private activeExplorers: IDataViewer[] = [];
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(DataViewerDependencyService) private dependencyService: DataViewerDependencyService
    ) {
        asyncRegistry.push(this);
    }

    public async dispose() {
        await Promise.all(this.activeExplorers.map(d => d.dispose()));
    }

    public async create(variable: IJupyterVariable, notebook: INotebook): Promise<IDataViewer> {
        let result: IDataViewer | undefined;

        // Create the data explorer (this should show the window)
        const dataExplorer = this.serviceContainer.get<IDataViewer>(IDataViewer);
        try {
            // Verify this is allowed.
            await this.dependencyService.checkAndInstallMissingDependencies(notebook.getMatchingInterpreter());

            // Then load the data.
            this.activeExplorers.push(dataExplorer);
            await dataExplorer.showVariable(variable, notebook);
            result = dataExplorer;
        } finally {
            if (!result) {
                // If throw any errors, close the window we opened.
                dataExplorer.dispose();
            }
        }
        return result;
    }
}
