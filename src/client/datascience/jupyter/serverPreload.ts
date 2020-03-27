// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable, named } from 'inversify';
import { Memento } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { traceError, traceInfo } from '../../common/logger';
import { IConfigurationService, IMemento, WORKSPACE_MEMENTO } from '../../common/types';
import { IInteractiveWindow, IInteractiveWindowProvider, INotebookEditorProvider, INotebookProvider } from '../types';

const LastServerActiveTimeKey = 'last-notebook-start-time';

@injectable()
export class ServerPreload implements IExtensionSingleActivationService {
    constructor(
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private mementoStorage: Memento,
        @inject(INotebookEditorProvider) private notebookEditorProvider: INotebookEditorProvider,
        @inject(IInteractiveWindowProvider) private interactiveProvider: IInteractiveWindowProvider,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(INotebookProvider) private notebookProvider: INotebookProvider
    ) {
        this.notebookEditorProvider.onDidOpenNotebookEditor(this.onDidOpenNotebook.bind(this));
        this.interactiveProvider.onDidChangeActiveInteractiveWindow(this.onDidOpenOrCloseInteractive.bind(this));
    }
    public activate(): Promise<void> {
        // This is the list of things that should cause us to start a local server
        // 1) Notebook is opened
        // 2) Notebook was opened in the past 7 days
        // 3) Interactive window was opened in the past 7 days
        // 4) Interactive window is opened
        // And the user has specified local server in their settings.
        this.checkDateForServerStart();

        // Don't hold up activation though
        return Promise.resolve();
    }

    private checkDateForServerStart() {
        const lastTimeNumber = this.mementoStorage.get<number>(LastServerActiveTimeKey);

        if (lastTimeNumber) {
            const lastTime = new Date(lastTimeNumber);
            const currentTime = new Date();
            const diff = currentTime.getTime() - lastTime.getTime();
            const diffInDays = Math.floor(diff / (24 * 3600 * 1000));
            if (diffInDays <= 7) {
                this.createServerIfNecessary().ignoreErrors();
            }
        }
    }

    private async createServerIfNecessary() {
        try {
            traceInfo(`Attempting to start a server because of preload conditions ...`);

            // May already have this server started.
            let server = await this.notebookProvider.getOrCreateServer({ getOnly: true, disableUI: true });

            // If it didn't start, attempt for local and if allowed.
            if (!server && !this.configService.getSettings(undefined).datascience.disableJupyterAutoStart) {
                // Local case, try creating one
                server = await this.notebookProvider.getOrCreateServer({
                    getOnly: false,
                    disableUI: true,
                    localOnly: true,
                });
            }

            if (server) {
                // Update our date in the storage that indicates it was succesful
                this.mementoStorage.update(LastServerActiveTimeKey, Date.now());
            }
        } catch (exc) {
            traceError(`Error starting server in serverPreload: `, exc);
        }
    }

    private onDidOpenNotebook() {
        // Automatically start a server whenever we open a notebook
        this.createServerIfNecessary().ignoreErrors();
    }

    private onDidOpenOrCloseInteractive(interactive: IInteractiveWindow | undefined) {
        if (interactive) {
            this.createServerIfNecessary().ignoreErrors();
        }
    }
}
