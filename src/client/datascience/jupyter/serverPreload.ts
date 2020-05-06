// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../../activation/types';
import { traceError, traceInfo } from '../../common/logger';
import { IConfigurationService } from '../../common/types';
import {
    IInteractiveWindow,
    IInteractiveWindowProvider,
    INotebookAndInteractiveWindowUsageTracker,
    INotebookEditorProvider,
    INotebookProvider
} from '../types';

@injectable()
export class ServerPreload implements IExtensionSingleActivationService {
    constructor(
        @inject(INotebookAndInteractiveWindowUsageTracker)
        private readonly tracker: INotebookAndInteractiveWindowUsageTracker,
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
        if (
            this.shouldAutoStartStartServer(this.tracker.lastInteractiveWindowOpened) ||
            this.shouldAutoStartStartServer(this.tracker.lastNotebookOpened)
        ) {
            this.createServerIfNecessary().ignoreErrors();
        }
    }
    private shouldAutoStartStartServer(lastTime?: Date) {
        if (!lastTime) {
            return false;
        }
        const currentTime = new Date();
        const diff = currentTime.getTime() - lastTime.getTime();
        const diffInDays = Math.floor(diff / (24 * 3600 * 1000));
        return diffInDays <= 7;
    }

    private async createServerIfNecessary() {
        try {
            traceInfo(`Attempting to start a server because of preload conditions ...`);

            // Check if we are already connected
            let providerConnection = await this.notebookProvider.connect({ getOnly: true, disableUI: true });

            // If it didn't start, attempt for local and if allowed.
            if (!providerConnection && !this.configService.getSettings(undefined).datascience.disableJupyterAutoStart) {
                // Local case, try creating one
                providerConnection = await this.notebookProvider.connect({
                    getOnly: false,
                    disableUI: true,
                    localOnly: true
                });
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
