// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { EventEmitter, ViewColumn, window } from 'vscode';
import { IWebPanelProvider, IWorkspaceService } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, Resource } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { ICodeCssGenerator, INotebookEditorProvider, IThemeFinder } from '../types';
import { WebViewHost } from '../webViewHost';
import { StartPageMessageListener } from './startPageMessageListener';
import { IStartPage, IStartPageMapping, StartPageMessages } from './types';

const startPageDir = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'viewers');

@injectable()
export class StartPage extends WebViewHost<IStartPageMapping> implements IStartPage {
    protected closedEvent: EventEmitter<IStartPage> = new EventEmitter<IStartPage>();

    constructor(
        @inject(IWebPanelProvider) provider: IWebPanelProvider,
        @inject(ICodeCssGenerator) cssGenerator: ICodeCssGenerator,
        @inject(IThemeFinder) themeFinder: IThemeFinder,
        @inject(IConfigurationService) protected configuration: IConfigurationService,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(IFileSystem) private file: IFileSystem,
        @inject(INotebookEditorProvider) private notebookEditorProvider: INotebookEditorProvider
    ) {
        super(
            configuration,
            provider,
            cssGenerator,
            themeFinder,
            workspaceService,
            (c, v, d) => new StartPageMessageListener(c, v, d),
            startPageDir,
            [path.join(startPageDir, 'commons.initial.bundle.js'), path.join(startPageDir, 'startPage.js')],
            localize.DataScience.startPage(),
            ViewColumn.One,
            false,
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
            case StartPageMessages.OpenBlankNotebook:
                await this.notebookEditorProvider.createNew();
                break;
            case StartPageMessages.OpenBlankPythonFile:
                break;
            case StartPageMessages.OpenInteractiveWindow:
                break;
            case StartPageMessages.OpenCommandPalette:
                break;
            case StartPageMessages.OpenCommandPaletteWithOpenNBSelected:
                break;
            case StartPageMessages.OpenSampleNotebook:
                break;
            case StartPageMessages.OpenFileBrowser:
                window.showOpenDialog({});
                break;
            default:
                break;
        }

        super.onMessage(message, payload);
    }

    private async handleReleaseNotesRequest() {
        const changelog = await this.file.readFile(path.join(EXTENSION_ROOT_DIR, 'CHANGELOG.md'));
        const changelogEnding = changelog.indexOf('### Fixes');
        const startOfLog = changelog.substring(0, changelogEnding);

        const whiteSpace = ' ';
        const dateEnd = startOfLog.indexOf(')');
        const dateBegin = startOfLog.indexOf('(');
        const scrappedDate = startOfLog.substring(dateBegin + 1, dateEnd).split(whiteSpace);

        const scrappedNotes = startOfLog.splitLines();
        const filteredNotes = scrappedNotes.filter((line) => line.startsWith('1.'));

        await this.postMessage(StartPageMessages.SendReleaseNotes, {
            date: scrappedDate[1] + whiteSpace + scrappedDate[2],
            notes: filteredNotes.map((line) => line.substr(3))
        });
    }
}
