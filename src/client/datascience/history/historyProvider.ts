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
import * as localize from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { Identifiers, LiveShare, LiveShareCommands, Settings } from '../constants';
import { PostOffice } from '../liveshare/postOffice';
import { IHistory, IHistoryProvider, INotebookServerOptions, IThemeFinder } from '../types';

interface ISyncData {
    count: number;
    waitable: Deferred<void>;
}

@injectable()
export class HistoryProvider implements IHistoryProvider, IAsyncDisposable {

    private activeHistory : IHistory | undefined;
    private postOffice : PostOffice;
    private id: string;
    private pendingSyncs : Map<string, ISyncData> = new Map<string, ISyncData>();
    private executedCode: EventEmitter<string> = new EventEmitter<string>();
    private activeHistoryExecuteHandler: Disposable | undefined;
    constructor(
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry : IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
        @inject(IThemeFinder) private themeFinder: IThemeFinder
        ) {
        asyncRegistry.push(this);

        // Create a post office so we can make sure history windows are created at the same time
        // on both sides.
        this.postOffice = new PostOffice(LiveShare.HistoryProviderService, liveShare);

        // Listen for peer changes
        this.postOffice.peerCountChanged((n) => this.onPeerCountChanged(n));

        // Listen for messages so we force a create on both sides.
        this.postOffice.registerCallback(LiveShareCommands.historyCreate, this.onRemoteCreate, this).ignoreErrors();
        this.postOffice.registerCallback(LiveShareCommands.historyCreateSync, this.onRemoteSync, this).ignoreErrors();

        // Make a unique id so we can tell who sends a message
        this.id = uuid();
    }

    public getActive() : IHistory | undefined {
        return this.activeHistory;
    }

    public get onExecutedCode() : Event<string> {
        return this.executedCode.event;
    }

    public async getOrCreateActive() : Promise<IHistory> {
        if (!this.activeHistory) {
            await this.create();
        }

        // Make sure all other providers have an active history.
        await this.synchronizeCreate();

        // Now that all of our peers have sync'd, return the history to use.
        if (this.activeHistory) {
            return this.activeHistory;
        }

        throw new Error(localize.DataScience.pythonInteractiveCreateFailed());
    }

    public async getNotebookOptions() : Promise<INotebookServerOptions> {
        // Find the settings that we are going to launch our server with
        const settings = this.configService.getSettings();
        let serverURI: string | undefined = settings.datascience.jupyterServerURI;
        const useDefaultConfig: boolean | undefined = settings.datascience.useDefaultConfigForJupyter;
        // Check for dark theme, if so set matplot lib to use dark_background settings
        let darkTheme: boolean | undefined = false;
        const workbench = this.workspaceService.getConfiguration('workbench');
        if (workbench) {
            const theme = workbench.get<string>('colorTheme');
            const ignoreTheme = this.configService.getSettings().datascience.ignoreVscodeTheme ? true : false;
            if (theme && !ignoreTheme) {
                darkTheme = await this.themeFinder.isThemeDark(theme);
            }
        }

        // For the local case pass in our URI as undefined, that way connect doesn't have to check the setting
        if (serverURI === Settings.JupyterServerLocalLaunch) {
            serverURI = undefined;
        }

        return {
            uri: serverURI,
            usingDarkTheme: darkTheme,
            useDefaultConfig,
            purpose: Identifiers.HistoryPurpose
        };
    }

    public dispose() : Promise<void> {
        return this.postOffice.dispose();
    }

    private async create() : Promise<void> {
        // Set it as soon as we create it. The .ctor for the history window
        // may cause a subclass to talk to the IHistoryProvider to get the active history.
        this.activeHistory = this.serviceContainer.get<IHistory>(IHistory);
        const handler = this.activeHistory.closed(this.onHistoryClosed);
        this.disposables.push(this.activeHistory);
        this.disposables.push(handler);
        this.activeHistoryExecuteHandler = this.activeHistory.onExecutedCode(this.onHistoryExecute);
        this.disposables.push(this.activeHistoryExecuteHandler);
        await this.activeHistory.ready;
    }

    private onPeerCountChanged(newCount: number) {
        // If we're losing peers, resolve all syncs
        if (newCount < this.postOffice.peerCount) {
            this.pendingSyncs.forEach(v => v.waitable.resolve());
            this.pendingSyncs.clear();
        }
    }

    // tslint:disable-next-line:no-any
    private async onRemoteCreate(...args: any[]) {
        // Should be a single arg, the originator of the create
        if (args.length > 0 && args[0].toString() !== this.id) {
            // The other side is creating a history window. Create on this side. We don't need to show
            // it as the running of new code should do that.
            if (!this.activeHistory) {
                await this.create();
            }

            // Tell the requestor that we got its message (it should be waiting for all peers to sync)
            this.postOffice.postCommand(LiveShareCommands.historyCreateSync, ...args).ignoreErrors();
        }
    }

    // tslint:disable-next-line:no-any
    private onRemoteSync(...args: any[]) {
        // Should be a single arg, the originator of the create
        if (args.length > 1 && args[0].toString() === this.id) {
            // Update our pending wait count on the matching pending sync
            const key = args[1].toString();
            const sync = this.pendingSyncs.get(key);
            if (sync) {
                sync.count -= 1;
                if (sync.count <= 0) {
                    sync.waitable.resolve();
                    this.pendingSyncs.delete(key);
                }
            }
        }
    }

    private onHistoryClosed = (history: IHistory) => {
        if (this.activeHistory === history) {
            this.activeHistory = undefined;
            if (this.activeHistoryExecuteHandler) {
                this.activeHistoryExecuteHandler.dispose();
                this.activeHistoryExecuteHandler = undefined;
            }
        }
    }

    private synchronizeCreate() : Promise<void> {
        // Create a new pending wait if necessary
        if (this.postOffice.peerCount > 0 || this.postOffice.role === vsls.Role.Guest) {
            const key = uuid();
            const waitable = createDeferred<void>();
            this.pendingSyncs.set(key, { count: this.postOffice.peerCount, waitable });

            // Make sure all providers have an active history
            this.postOffice.postCommand(LiveShareCommands.historyCreate, this.id, key).ignoreErrors();

            // Wait for the waitable to be signaled or the peer count on the post office to change
            return waitable.promise;
        }

        return Promise.resolve();
    }

    private onHistoryExecute = (code: string) => {
        this.executedCode.fire(code);
    }

}
