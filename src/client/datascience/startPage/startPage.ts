// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { EventEmitter, Uri, ViewColumn } from 'vscode';
import { IWebPanelProvider, IWorkspaceService } from '../../common/application/types';
import { IConfigurationService, Resource } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { ICodeCssGenerator, IThemeFinder } from '../types';
import { WebViewHost } from '../webViewHost';
import { StartPageMessageListener } from './startPageMessageListener';
import { IStartPage, IStartPageMapping, StartPageMessages } from './types';

const startPageDir = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'viewers');
// const startPageDir2 = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'viewers');

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
        @inject(IWorkspaceService) workspaceService: IWorkspaceService
        // @unmanaged() protected errorHandler: IDataScienceErrorHandler,
        // @unmanaged() protected readonly commandManager: ICommandManager,
        // @unmanaged() protected globalStorage: Memento,
        // @inject(String) rootPath: string,
        // @inject(String) scripts: string[],
        // @inject(String) title: string,
        // @unmanaged() viewColumn: ViewColumn,
        // @inject(IExperimentsManager) experimentsManager: IExperimentsManager
        // @inject(Boolean) useCustomEditorApi: boolean
    ) {
        super(
            configuration,
            provider,
            cssGenerator,
            themeFinder,
            workspaceService,
            (c, v, d) => new StartPageMessageListener(c, v, d),
            startPageDir,
            [
                // path.join(startPageDir2, 'require.js'),
                path.join(startPageDir, 'commons.initial.bundle.js'),
                path.join(startPageDir, 'startPage.js')
            ],
            localize.DataScience.startPage(),
            ViewColumn.One,
            false,
            false
        );
    }

    public dispose(): Promise<void> {
        super.dispose();
        return this.close();
    }

    public async open(): Promise<void> {
        await this.loadWebPanel(process.cwd());
        // open webview
        await super.show(true);
    }

    public async getOwningResource(): Promise<Resource> {
        return Promise.resolve(undefined);
    }

    public async close(): Promise<void> {
        // Fire our event
        this.closedEvent.fire(this);
    }

    // tslint:disable-next-line: no-any
    public async onMessage(message: string, payload: any) {
        switch (message) {
            case StartPageMessages.RequestReleaseNotes:
                await this.handleReleaseNotesRequest();
                break;

            default:
                break;
        }

        super.onMessage(message, payload);
    }

    private async handleReleaseNotesRequest() {
        await this.postMessage(StartPageMessages.SendReleaseNotes, { date: 'aaa', notes: ['cool', 'stuff'] });
    }
}
