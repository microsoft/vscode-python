// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { injectable, unmanaged } from 'inversify';
import { Uri, ViewColumn } from 'vscode';
import { IWebPanelProvider, IWorkspaceService } from '../../common/application/types';
import { IConfigurationService, IExperimentsManager, Resource } from '../../common/types';
import { ICodeCssGenerator, IThemeFinder } from '../types';
import { WebViewHost } from '../webViewHost';
import { StartPageMessageListener } from './startPageMessageListener';
import { IStartPage, IStartPageMapping } from './types';
// import * as path from 'path';

@injectable()
export class StartPage extends WebViewHost<IStartPageMapping> implements IStartPage {
    constructor(
        // @unmanaged() liveShare: ILiveShareApi,
        // @unmanaged() protected applicationShell: IApplicationShell,
        // @unmanaged() protected documentManager: IDocumentManager,
        @unmanaged() provider: IWebPanelProvider,
        @unmanaged() cssGenerator: ICodeCssGenerator,
        @unmanaged() themeFinder: IThemeFinder,
        // @unmanaged() protected jupyterExecution: IJupyterExecution,
        // @unmanaged() protected fileSystem: IFileSystem,
        @unmanaged() protected configuration: IConfigurationService,
        // @unmanaged() protected jupyterExporter: INotebookExporter,
        @unmanaged() workspaceService: IWorkspaceService,
        // @unmanaged() protected errorHandler: IDataScienceErrorHandler,
        // @unmanaged() protected readonly commandManager: ICommandManager,
        // @unmanaged() protected globalStorage: Memento,
        @unmanaged() rootPath: string,
        @unmanaged() scripts: string[],
        @unmanaged() title: string,
        @unmanaged() viewColumn: ViewColumn,
        @unmanaged() experimentsManager: IExperimentsManager,
        @unmanaged() useCustomEditorApi: boolean
    ) {
        super(
            configuration,
            provider,
            cssGenerator,
            themeFinder,
            workspaceService,
            (c, v, d) => new StartPageMessageListener(c, v, d),
            rootPath,
            scripts,
            title,
            viewColumn,
            experimentsManager.inExperiment(''),
            useCustomEditorApi
        );
    }
    public get file(): Uri {
        return Uri.file('');
    }
    public async open(): Promise<void> {
        // open webview
        await super.show(true);
    }

    public async getOwningResource(): Promise<Resource> {
        return this.file;
    }
}
