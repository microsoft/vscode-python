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
import { ExtensionChannel } from '../../common/insidersBuild/types';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, IExtensionContext, Resource } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { StopWatch } from '../../common/utils/stopWatch';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { sendTelemetryEvent } from '../../telemetry';
import { Commands, Telemetry } from '../constants';
import { ICodeCssGenerator, INotebookEditorProvider, IThemeFinder } from '../types';
import { WebViewHost } from '../webViewHost';
import { StartPageMessageListener } from './startPageMessageListener';
import { IStartPage, IStartPageMapping, StartPageMessages } from './types';

const startPageDir = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'viewers');

// Class that opens, disposes and handles messages and actions for the Python Extension Start Page.
// It also runs when the extension activates.
@injectable()
export class StartPage extends WebViewHost<IStartPageMapping> implements IStartPage, IExtensionSingleActivationService {
    protected closedEvent: EventEmitter<IStartPage> = new EventEmitter<IStartPage>();
    private timer: StopWatch;
    private actionTaken = false;
    private actionTakenOnFirstTime = false;
    private firstTime = false;
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
        this.timer = new StopWatch();
    }

    public async activate(): Promise<void> {
        const settings = this.configuration.getSettings();

        if (settings.showStartPage && settings.insidersChannel === ExtensionChannel.off) {
            // extesionVersionChanged() reads CHANGELOG.md
            // So we use separate if's to try and avoid reading a file every time
            const firstTimeOrUpdate = await this.extensionVersionChanged();

            if (firstTimeOrUpdate) {
                this.firstTime = true;
                this.open().ignoreErrors();
            }
        }
    }

    public dispose(): Promise<void> {
        if (!this.isDisposed) {
            super.dispose();
        }
        return this.close();
    }

    public async open(): Promise<void> {
        sendTelemetryEvent(Telemetry.StartPageViewed);
        await this.loadWebPanel(process.cwd());
        // open webview
        await super.show(true);
    }

    public async getOwningResource(): Promise<Resource> {
        return Promise.resolve(undefined);
    }

    public async close(): Promise<void> {
        if (!this.actionTaken) {
            sendTelemetryEvent(Telemetry.StartPageClosedWithoutAction);
        }
        if (this.actionTakenOnFirstTime) {
            sendTelemetryEvent(Telemetry.StartPageUsedAnActionOnFirstTime);
        }
        sendTelemetryEvent(Telemetry.StartPageTime, this.timer.elapsedTime);
        // Fire our event
        this.closedEvent.fire(this);
    }

    // tslint:disable-next-line: no-any
    public async onMessage(message: string, payload: any) {
        switch (message) {
            case StartPageMessages.RequestReleaseNotesAndShowAgainSetting:
                await this.handleReleaseNotesRequest();
                break;
            case StartPageMessages.OpenBlankNotebook:
                sendTelemetryEvent(Telemetry.StartPageOpenBlankNotebook);
                this.setTelemetryFlags();

                const savedVersion: string | undefined = this.context.globalState.get('extensionVersion');

                if (savedVersion) {
                    await this.notebookEditorProvider.createNew();
                } else {
                    this.openSampleNotebook().ignoreErrors();
                }
                break;
            case StartPageMessages.OpenBlankPythonFile:
                sendTelemetryEvent(Telemetry.StartPageOpenBlankPythonFile);
                this.setTelemetryFlags();

                const doc = await this.documentManager.openTextDocument({ language: 'python' });
                this.documentManager.showTextDocument(doc, 1, true);
                break;
            case StartPageMessages.OpenInteractiveWindow:
                sendTelemetryEvent(Telemetry.StartPageOpenInteractiveWindow);
                this.setTelemetryFlags();

                const doc2 = await this.documentManager.openTextDocument({
                    language: 'python',
                    content: `#%%\nprint("${localize.DataScience.helloWorld()}")`
                });
                await this.documentManager.showTextDocument(doc2, 1, true);
                await this.commandManager.executeCommand(Commands.ShowHistoryPane);
                this.commandManager.executeCommand(Commands.RunAllCells, '');
                break;
            case StartPageMessages.OpenCommandPalette:
                sendTelemetryEvent(Telemetry.StartPageOpenCommandPalette);
                this.setTelemetryFlags();

                commands.executeCommand('workbench.action.showCommands');
                break;
            case StartPageMessages.OpenCommandPaletteWithOpenNBSelected:
                sendTelemetryEvent(Telemetry.StartPageOpenCommandPaletteWithOpenNBSelected);
                this.setTelemetryFlags();

                commands.executeCommand('workbench.action.quickOpen', '>Create New Blank Jupyter Notebook');
                break;
            case StartPageMessages.OpenSampleNotebook:
                sendTelemetryEvent(Telemetry.StartPageOpenSampleNotebook);
                this.setTelemetryFlags();

                this.openSampleNotebook().ignoreErrors();
                break;
            case StartPageMessages.OpenFileBrowser:
                sendTelemetryEvent(Telemetry.StartPageOpenFileBrowser);
                this.setTelemetryFlags();

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
                if (payload === false) {
                    sendTelemetryEvent(Telemetry.StartPageClickedDontShowAgain);
                }
                await this.configuration.updateSetting('showStartPage', payload, undefined, ConfigurationTarget.Global);
                break;
            default:
                break;
        }

        super.onMessage(message, payload);
    }

    // This gets the most recent Enhancements and date from CHANGELOG.md
    private async handleReleaseNotesRequest() {
        const settings = this.configuration.getSettings();
        const changelog = await this.file.readFile(path.join(EXTENSION_ROOT_DIR, 'CHANGELOG.md'));
        const changelogBeginning = changelog.indexOf('### Enhancements');
        const changelogEnding = changelog.indexOf('### Fixes', changelogBeginning);
        const startOfLog = changelog.substring(changelogBeginning, changelogEnding);

        const scrappedNotes = startOfLog.splitLines();
        const filteredNotes = scrappedNotes.filter((line) => line.startsWith('1.'));

        await this.postMessage(StartPageMessages.SendReleaseNotes, {
            notes: filteredNotes.map((line) => line.substr(3)),
            showAgainSetting: settings.showStartPage
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

    private setTelemetryFlags() {
        if (this.firstTime) {
            this.actionTakenOnFirstTime = true;
        }
        this.actionTaken = true;
    }
}
