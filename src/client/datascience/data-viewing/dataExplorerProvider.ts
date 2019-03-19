// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as uuid from 'uuid/v4';
import { Disposable, Event, EventEmitter } from 'vscode';
import * as vsls from 'vsls/vscode';

import { ILiveShareApi, IWorkspaceService } from '../../common/application/types';
import { IAsyncDisposable, IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import { IServiceContainer } from '../../ioc/types';
import { Identifiers, LiveShare, LiveShareCommands, Settings } from '../constants';
import { PostOffice } from '../liveshare/postOffice';
import { IHistory, IHistoryProvider, INotebookServerOptions, IThemeFinder, IDataExplorer, IDataExplorerProvider, IDataExplorerRow } from '../types';
import { DataExplorer } from './dataExplorer';


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
