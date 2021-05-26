// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ConfigurationTarget, EventEmitter, UIKind, Uri, ViewColumn } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { sendTelemetryEvent } from '../../telemetry';
import {
    CommandSource,
    IApplicationEnvironment,
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    IWebviewPanelProvider,
    IWorkspaceService,
} from '../application/types';
import { IFileSystem } from '../platform/types';
import { IConfigurationService, IExtensionContext, Resource } from '../types';
import * as localize from '../utils/localize';
import { StopWatch } from '../utils/stopWatch';
import { Telemetry } from './constants';
import { StartPageMessageListener } from './startPageMessageListener';
import { ICodeCssGenerator, IStartPage, IStartPageMapping, IThemeFinder, StartPageMessages } from './types';
import { WebviewPanelHost } from './webviewPanelHost';

const startPageDir = path.join(EXTENSION_ROOT_DIR, 'out', 'startPage-ui', 'viewers');

export const EXTENSION_VERSION_MEMENTO = 'extensionVersion';

// Class that opens, disposes and handles messages and actions for the Python Extension Start Page.
// It also runs when the extension activates.
@injectable()
export class StartPage extends WebviewPanelHost<IStartPageMapping>
    implements IStartPage, IExtensionSingleActivationService {
    protected closedEvent: EventEmitter<IStartPage> = new EventEmitter<IStartPage>();

    private timer: StopWatch;

    private actionTaken = false;

    private actionTakenOnFirstTime = false;

    private firstTime = false;

    private webviewDidLoad = false;

    public initialMementoValue: string | undefined = undefined;

    constructor(
        @inject(IWebviewPanelProvider) provider: IWebviewPanelProvider,
        @inject(ICodeCssGenerator) cssGenerator: ICodeCssGenerator,
        @inject(IThemeFinder) themeFinder: IThemeFinder,
        @inject(IConfigurationService) protected configuration: IConfigurationService,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(IFileSystem) private file: IFileSystem,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IExtensionContext) private readonly context: IExtensionContext,
        @inject(IApplicationEnvironment) private appEnvironment: IApplicationEnvironment,
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
            localize.StartPage.getStarted(),
            ViewColumn.One,
            false,
        );
        this.timer = new StopWatch();
        this.initialMementoValue = this.context.globalState.get(EXTENSION_VERSION_MEMENTO);
    }

    public async activate(): Promise<void> {
        if (this.appEnvironment.uiKind === UIKind.Web) {
            // We're running in Codespaces browser-based editor, do not open start page.
            return;
        }
        this.activateBackground().ignoreErrors();
    }

    public dispose(): Promise<void> {
        if (!this.isDisposed) {
            super.dispose();
        }
        return this.close();
    }

    public async open(): Promise<void> {
        sendTelemetryEvent(Telemetry.StartPageViewed);
        setTimeout(async () => {
            await this.loadWebPanel(process.cwd());
            // open webview
            await super.show(true);

            setTimeout(() => {
                if (!this.webviewDidLoad) {
                    sendTelemetryEvent(Telemetry.StartPageWebViewError);
                }
            }, 5000);
        }, 3000);
    }

    // eslint-disable-next-line class-methods-use-this
    public get owningResource(): Resource {
        return undefined;
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

    public async onMessage(message: string, payload: unknown): Promise<void> {
        switch (message) {
            case StartPageMessages.Started:
                this.webviewDidLoad = true;
                break;
            case StartPageMessages.RequestShowAgainSetting: {
                const settings = this.configuration.getSettings();
                await this.postMessage(StartPageMessages.SendSetting, {
                    showAgainSetting: settings.showStartPage,
                });
                break;
            }
            case StartPageMessages.OpenBlankNotebook: {
                sendTelemetryEvent(Telemetry.StartPageOpenBlankNotebook);
                this.setTelemetryFlags();

                const savedVersion: string | undefined = this.context.globalState.get(EXTENSION_VERSION_MEMENTO);

                if (savedVersion) {
                    await this.commandManager.executeCommand(
                        'jupyter.opennotebook',
                        undefined,
                        CommandSource.commandPalette,
                    );
                } else {
                    this.openSampleNotebook().ignoreErrors();
                }
                break;
            }
            case StartPageMessages.OpenBlankPythonFile: {
                sendTelemetryEvent(Telemetry.StartPageOpenBlankPythonFile);
                this.setTelemetryFlags();

                const doc = await this.documentManager.openTextDocument({
                    language: 'python',
                    content: `print("${localize.StartPage.helloWorld()}")`,
                });
                await this.documentManager.showTextDocument(doc, 1, true);
                break;
            }
            case StartPageMessages.OpenInteractiveWindow: {
                sendTelemetryEvent(Telemetry.StartPageOpenInteractiveWindow);
                this.setTelemetryFlags();

                const doc2 = await this.documentManager.openTextDocument({
                    language: 'python',
                    content: `#%%\nprint("${localize.StartPage.helloWorld()}")`,
                });
                await this.documentManager.showTextDocument(doc2, 1, true);
                await this.commandManager.executeCommand('jupyter.runallcells', Uri.parse(''));
                break;
            }
            case StartPageMessages.OpenCommandPalette:
                sendTelemetryEvent(Telemetry.StartPageOpenCommandPalette);
                this.setTelemetryFlags();

                await this.commandManager.executeCommand('workbench.action.showCommands');
                break;
            case StartPageMessages.OpenCommandPaletteWithOpenNBSelected:
                sendTelemetryEvent(Telemetry.StartPageOpenCommandPaletteWithOpenNBSelected);
                this.setTelemetryFlags();

                await this.commandManager.executeCommand('workbench.action.quickOpen', '>Create New Blank Notebook');
                break;
            case StartPageMessages.OpenSampleNotebook:
                sendTelemetryEvent(Telemetry.StartPageOpenSampleNotebook);
                this.setTelemetryFlags();

                this.openSampleNotebook().ignoreErrors();
                break;
            case StartPageMessages.OpenFileBrowser: {
                sendTelemetryEvent(Telemetry.StartPageOpenFileBrowser);
                this.setTelemetryFlags();

                const uri = await this.appShell.showOpenDialog({
                    filters: {
                        Python: ['py', 'ipynb'],
                    },
                    canSelectMany: false,
                });
                if (uri) {
                    const doc3 = await this.documentManager.openTextDocument(uri[0]);
                    await this.documentManager.showTextDocument(doc3);
                }
                break;
            }
            case StartPageMessages.OpenFolder:
                sendTelemetryEvent(Telemetry.StartPageOpenFolder);
                this.setTelemetryFlags();
                this.commandManager.executeCommand('workbench.action.files.openFolder');
                break;
            case StartPageMessages.OpenWorkspace:
                sendTelemetryEvent(Telemetry.StartPageOpenWorkspace);
                this.setTelemetryFlags();
                this.commandManager.executeCommand('workbench.action.openWorkspace');
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

    // Public for testing
    public async extensionVersionChanged(): Promise<boolean> {
        const savedVersion: string | undefined = this.context.globalState.get(EXTENSION_VERSION_MEMENTO);
        const { version } = this.appEnvironment.packageJson;
        let shouldShowStartPage: boolean;

        if (savedVersion) {
            if (savedVersion === version || this.savedVersionisOlder(savedVersion, version)) {
                // There has not been an update
                shouldShowStartPage = false;
            } else {
                sendTelemetryEvent(Telemetry.StartPageOpenedFromNewUpdate);
                shouldShowStartPage = true;
            }
        } else {
            sendTelemetryEvent(Telemetry.StartPageOpenedFromNewInstall);
            shouldShowStartPage = true;
        }

        // savedVersion being undefined means this is the first time the user activates the extension.
        // if savedVersion != version, there was an update
        await this.context.globalState.update(EXTENSION_VERSION_MEMENTO, version);
        return shouldShowStartPage;
    }

    private async activateBackground(): Promise<void> {
        const settings = this.configuration.getSettings();

        if (settings.showStartPage && this.appEnvironment.extensionChannel === 'stable') {
            // extesionVersionChanged() reads CHANGELOG.md
            // So we use separate if's to try and avoid reading a file every time
            const firstTimeOrUpdate = await this.extensionVersionChanged();

            if (firstTimeOrUpdate) {
                this.firstTime = true;
                this.open().ignoreErrors();
            }
        }
    }

    // eslint-disable-next-line class-methods-use-this
    private savedVersionisOlder(savedVersion: string, actualVersion: string): boolean {
        const saved = savedVersion.split('.');
        const actual = actualVersion.split('.');

        switch (true) {
            case Number(actual[0]) > Number(saved[0]):
                return false;
            case Number(actual[0]) < Number(saved[0]):
                return true;
            case Number(actual[1]) > Number(saved[1]):
                return false;
            case Number(actual[1]) < Number(saved[1]):
                return true;
            case Number(actual[2][0]) > Number(saved[2][0]):
                return false;
            case Number(actual[2][0]) < Number(saved[2][0]):
                return true;
            default:
                return false;
        }
    }

    private async openSampleNotebook(): Promise<void> {
        const ipynb = '.ipynb';
        const localizedFilePath = path.join(
            EXTENSION_ROOT_DIR,
            'pythonFiles',
            localize.StartPage.sampleNotebook() + ipynb,
        );
        let sampleNotebookPath: string;

        if (await this.file.fileExists(localizedFilePath)) {
            sampleNotebookPath = localizedFilePath;
        } else {
            sampleNotebookPath = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'Notebooks intro.ipynb');
        }

        await this.commandManager.executeCommand(
            'jupyter.opennotebook',
            Uri.file(sampleNotebookPath),
            CommandSource.commandPalette,
        );
    }

    private setTelemetryFlags() {
        if (this.firstTime) {
            this.actionTakenOnFirstTime = true;
        }
        this.actionTaken = true;
    }
}
