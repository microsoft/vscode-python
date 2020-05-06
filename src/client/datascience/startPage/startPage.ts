// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { inject, injectable } from 'inversify';
import { EventEmitter, Uri } from 'vscode';
import { IWebPanelProvider, IWorkspaceService } from '../../common/application/types';
import { IConfigurationService, IExperimentsManager, Resource } from '../../common/types';
import { ICodeCssGenerator, IThemeFinder } from '../types';
import { WebViewHost } from '../webViewHost';
import { StartPageMessageListener } from './startPageMessageListener';
import { IStartPage, IStartPageMapping } from './types';
// import * as path from 'path';

@injectable()
export class StartPage extends WebViewHost<IStartPageMapping> implements IStartPage {
    protected closedEvent: EventEmitter<IStartPage> = new EventEmitter<IStartPage>();

    constructor(
        // @unmanaged() liveShare: ILiveShareApi,
        // @unmanaged() protected applicationShell: IApplicationShell,
        // @unmanaged() protected documentManager: IDocumentManager,
        @inject(IWebPanelProvider) provider: IWebPanelProvider,
        @inject(ICodeCssGenerator) cssGenerator: ICodeCssGenerator,
        @inject(IThemeFinder) themeFinder: IThemeFinder,
        // @unmanaged() protected jupyterExecution: IJupyterExecution,
        // @unmanaged() protected fileSystem: IFileSystem,
        @inject(IConfigurationService) protected configuration: IConfigurationService,
        // @unmanaged() protected jupyterExporter: INotebookExporter,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        // @unmanaged() protected errorHandler: IDataScienceErrorHandler,
        // @unmanaged() protected readonly commandManager: ICommandManager,
        // @unmanaged() protected globalStorage: Memento,
        // @inject(String) rootPath: string,
        // @inject(String) scripts: string[],
        // @inject(String) title: string,
        // @unmanaged() viewColumn: ViewColumn,
        @inject(IExperimentsManager) experimentsManager: IExperimentsManager
        // @inject(Boolean) useCustomEditorApi: boolean
    ) {
        super(
            configuration,
            provider,
            cssGenerator,
            themeFinder,
            workspaceService,
            (c, v, d) => new StartPageMessageListener(c, v, d),
            'asd',
            [''],
            'Kut',
            1,
            experimentsManager.inExperiment(''),
            true
        );
    }

    public dispose(): Promise<void> {
        super.dispose();
        return this.close();
    }

    public get file(): Uri {
        return Uri.file('asd');
    }
    public async open(): Promise<void> {
        await this.loadWebPanel(process.cwd());
        // open webview
        await super.show(true);
    }

    public async getOwningResource(): Promise<Resource> {
        return this.file;
    }

    public async close(): Promise<void> {
        // Fire our event
        this.closedEvent.fire(this);
    }
}
