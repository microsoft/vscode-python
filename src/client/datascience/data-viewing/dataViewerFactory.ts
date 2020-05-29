// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';

import { IAsyncDisposable, IAsyncDisposableRegistry } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { IDataViewer, IDataViewerDataProvider, IDataViewerFactory } from './types';

@injectable()
export class DataViewerFactory implements IDataViewerFactory, IAsyncDisposable {
    private activeExplorers: IDataViewer[] = [];
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry
    ) {
        asyncRegistry.push(this);
    }

    public async dispose() {
        await Promise.all(this.activeExplorers.map((d) => d.dispose()));
    }

    public async create(dataProvider: IDataViewerDataProvider, title: string): Promise<IDataViewer> {
        let result: IDataViewer | undefined;

        // Create the data explorer
        const dataExplorer = this.serviceContainer.get<IDataViewer>(IDataViewer);
        try {
            // Then load the data.
            this.activeExplorers.push(dataExplorer);

            // Show the window and the data
            await dataExplorer.showData(dataProvider, title);
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
