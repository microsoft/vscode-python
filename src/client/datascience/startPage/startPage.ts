// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { commands, ConfigurationTarget, EventEmitter, ViewColumn } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    IWebPanelProvider,
    IWorkspaceService
} from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, IExtensionContext, Resource } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { Commands } from '../constants';
import { ICodeCssGenerator, INotebookEditorProvider, IThemeFinder } from '../types';
import { WebViewHost } from '../webViewHost';
// import { extensionVersionChanged, openSampleNotebook } from './helpers';
import { StartPageMessageListener } from './startPageMessageListener';
import { IStartPage, IStartPageMapping, StartPageMessages } from './types';

const startPageDir = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'viewers');

@injectable()
export class StartPage extends WebViewHost<IStartPageMapping> implements IStartPage, IExtensionSingleActivationService {
    protected closedEvent: EventEmitter<IStartPage> = new EventEmitter<IStartPage>();

    constructor(
        @inject(IWebPanelProvider) provider: IWebPanelProvider,
        @inject(ICodeCssGenerator) cssGenerator: ICodeCssGenerator,
        @inject(IThemeFinder) themeFinder: IThemeFinder,
        @inject(IConfigurationService) protected configuration: IConfigurationService,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(IFileSystem) private file: IFileSystem,
        @inject(INotebookEditorProvider) private notebookEditorProvider: INotebookEditorProvider,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IExtensionContext) private readonly context: IExtensionContext
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

    public async activate(): Promise<void> {
        const settings = this.configuration.getSettings();

        if (settings.showStartPage) {
            // Use separate if's to try and avoid reading a file every time
            const firstTimeOrUpdate = await this.extensionVersionChanged();

            if (firstTimeOrUpdate) {
                // tslint:disable-next-line: no-floating-promises
                this.open();
            }
        }
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
                const savedVersion: string | undefined = this.context.globalState.get('extensionVersion');

                if (savedVersion) {
                    await this.notebookEditorProvider.createNew();
                } else {
                    // tslint:disable-next-line: no-floating-promises
                    this.openSampleNotebook();
                }
                break;
            case StartPageMessages.OpenBlankPythonFile:
                const doc = await this.documentManager.openTextDocument({ language: 'python' });
                this.documentManager.showTextDocument(doc, 1, true);
                break;
            case StartPageMessages.OpenInteractiveWindow:
                const doc2 = await this.documentManager.openTextDocument({
                    language: 'python',
                    content: '#%%\nprint("Hello world")'
                });
                await this.documentManager.showTextDocument(doc2, 1, true);
                await this.commandManager.executeCommand(Commands.ShowHistoryPane);
                this.commandManager.executeCommand(Commands.RunAllCells, '');
                break;
            case StartPageMessages.OpenCommandPalette:
                commands.executeCommand('workbench.action.showCommands');
                break;
            case StartPageMessages.OpenCommandPaletteWithOpenNBSelected:
                commands.executeCommand('workbench.action.quickOpen', '>Create New Blank Jupyter Notebook');
                break;
            case StartPageMessages.OpenSampleNotebook:
                // tslint:disable-next-line: no-floating-promises
                this.openSampleNotebook();
                break;
            case StartPageMessages.OpenFileBrowser:
                const uri = await this.appShell.showOpenDialog({
                    filters: {
                        Python: ['py', 'ipynb']
                    },
                    canSelectMany: false
                });
                if (uri) {
                    const doc3 = await this.documentManager.openTextDocument(uri[0]);
                    this.documentManager.showTextDocument(doc3);
                }
                break;
            case StartPageMessages.UpdateSettings:
                await this.configuration.updateSetting('showStartPage', payload, undefined, ConfigurationTarget.Global);
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

    private async extensionVersionChanged(): Promise<boolean> {
        const savedVersion: string | undefined = this.context.globalState.get('extensionVersion');

        const packageJson = await this.file.readFile(path.join(EXTENSION_ROOT_DIR, 'package.json'));
        const searchString = '"version": "';
        const startIndex = packageJson.indexOf(searchString);
        const endIndex = packageJson.indexOf('",', startIndex);
        const version = packageJson.substring(startIndex + searchString.length, endIndex);

        if (savedVersion && savedVersion === version) {
            // There has not been an update
            return false;
        }

        // savedVersion being undefined means this is the first time the user activates the extension.
        // if savedVersion != version, there was an update
        this.context.globalState.update('extensionVersion', version);
        return true;
    }

    private async openSampleNotebook(): Promise<void> {
        const sampleNotebook = await this.documentManager.openTextDocument(
            path.join(
                EXTENSION_ROOT_DIR,
                'src',
                'client',
                'datascience',
                'startPage',
                'SampleNotebook',
                'Welcome_To_VSCode_Notebooks.ipynb'
            )
        );
        this.documentManager.showTextDocument(sampleNotebook, 1, true);
    }
}
