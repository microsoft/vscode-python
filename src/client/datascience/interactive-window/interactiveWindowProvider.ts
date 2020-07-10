// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable, named } from 'inversify';
import * as uuid from 'uuid/v4';
import { Event, EventEmitter, Memento, Uri } from 'vscode';
import * as vsls from 'vsls/vscode';

import { ConfigurationTarget } from 'vscode';
import { IApplicationShell, ILiveShareApi } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import {
    GLOBAL_MEMENTO,
    IAsyncDisposable,
    IAsyncDisposableRegistry,
    IConfigurationService,
    IDisposableRegistry,
    IMemento,
    InteractiveWindowMode,
    Resource
} from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { LiveShare, LiveShareCommands } from '../constants';
import { PostOffice } from '../liveshare/postOffice';
import {
    IDataScienceErrorHandler,
    IInteractiveWindow,
    IInteractiveWindowLoadable,
    IInteractiveWindowProvider
} from '../types';

interface ISyncData {
    count: number;
    waitable: Deferred<void>;
}

const AskedForPerFileSettingKey = 'ds_asked_per_file_interactive';

@injectable()
export class InteractiveWindowProvider implements IInteractiveWindowProvider, IAsyncDisposable {
    public get onDidChangeActiveInteractiveWindow(): Event<IInteractiveWindow | undefined> {
        return this._onDidChangeActiveInteractiveWindow.event;
    }
    public get activeWindow(): IInteractiveWindow | undefined {
        return this._windows.find((w) => w.active && w.visible);
    }
    public get windows(): ReadonlyArray<IInteractiveWindow> {
        return this._windows;
    }
    private readonly _onDidChangeActiveInteractiveWindow = new EventEmitter<IInteractiveWindow | undefined>();
    private lastActiveInteractiveWindow: IInteractiveWindow | undefined;
    private postOffice: PostOffice;
    private id: string;
    private pendingSyncs: Map<string, ISyncData> = new Map<string, ISyncData>();
    private _windows: IInteractiveWindowLoadable[] = [];
    constructor(
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem,
        @inject(IDataScienceErrorHandler) private readonly errorHandler: IDataScienceErrorHandler,
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        @inject(IMemento) @named(GLOBAL_MEMENTO) private readonly globalMemento: Memento,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell
    ) {
        asyncRegistry.push(this);

        // Create a post office so we can make sure interactive windows are created at the same time
        // on both sides.
        this.postOffice = new PostOffice(LiveShare.InteractiveWindowProviderService, liveShare);

        // Listen for peer changes
        this.postOffice.peerCountChanged((n) => this.onPeerCountChanged(n));

        // Listen for messages so we force a create on both sides.
        this.postOffice
            .registerCallback(LiveShareCommands.interactiveWindowCreate, this.onRemoteCreate, this)
            .ignoreErrors();
        this.postOffice
            .registerCallback(LiveShareCommands.interactiveWindowCreateSync, this.onRemoteSync, this)
            .ignoreErrors();

        // Make a unique id so we can tell who sends a message
        this.id = uuid();
    }

    public async getOrCreate(resource: Resource): Promise<IInteractiveWindow> {
        // Ask for a configuration change if appropriate
        const mode = await this.getInteractiveMode(resource);

        // See if we already have a match
        let result = this.get(resource, mode);
        if (!result) {
            // No match. Create a new item.
            result = this.create(resource, mode);

            // Wait for synchronization in liveshare
            await this.synchronize(result);
        }

        return result;
    }

    public dispose(): Promise<void> {
        return this.postOffice.dispose();
    }

    public async synchronize(window: IInteractiveWindow): Promise<void> {
        // Create a new pending wait if necessary
        if (this.postOffice.peerCount > 0 || this.postOffice.role === vsls.Role.Guest) {
            const key = window.identity.toString();
            const owner = window.owner?.toString();
            const waitable = createDeferred<void>();
            this.pendingSyncs.set(key, { count: this.postOffice.peerCount, waitable });

            // Make sure all providers have an active interactive window
            await this.postOffice.postCommand(LiveShareCommands.interactiveWindowCreate, this.id, key, owner);

            // Wait for the waitable to be signaled or the peer count on the post office to change
            await waitable.promise;
        }
    }

    private async getInteractiveMode(resource: Resource): Promise<InteractiveWindowMode> {
        let result = this.configService.getSettings(resource).datascience.interactiveWindowMode;

        // Ask user if still at default value and they're opening a second file.
        if (
            result === 'multiple' &&
            resource &&
            !this.globalMemento.get(AskedForPerFileSettingKey) &&
            this._windows.length === 1
        ) {
            // See if the first window was tied to a file or not.
            const firstWindow = this._windows.find((w) => w.owner);
            if (firstWindow) {
                this.globalMemento.update(AskedForPerFileSettingKey, true);
                const questions = [
                    localize.DataScience.interactiveWindowModeBannerSwitchYes(),
                    localize.DataScience.interactiveWindowModeBannerSwitchNo()
                ];
                // Ask user if they'd like to switch to per file or not.
                const response = await this.appShell.showInformationMessage(
                    localize.DataScience.interactiveWindowModeBannerTitle(),
                    ...questions
                );
                if (response === questions[0]) {
                    result = 'perFile';
                    firstWindow.changeMode(result);
                    await this.configService.updateSetting(
                        'dataScience.interactiveWindowMode',
                        result,
                        resource,
                        ConfigurationTarget.Global
                    );
                }
            }
        }
        return result;
    }

    private get(owner: Resource, interactiveMode: InteractiveWindowMode): IInteractiveWindow | undefined {
        // Single mode means there's only ever one.
        if (interactiveMode === 'single') {
            return this._windows.length > 0 ? this._windows[0] : undefined;
        }

        // Multiple means use last active window or create a new one
        // if not owned.
        if (interactiveMode === 'multiple') {
            // Owner being undefined means create a new window, othewise use
            // the last active window.
            return owner ? this.activeWindow || this.lastActiveInteractiveWindow || this._windows[0] : undefined;
        }

        // Otherwise match the owner.
        return this._windows.find((w) => {
            if (!owner && !w.owner) {
                return true;
            }
            if (owner && w.owner && this.fileSystem.arePathsSame(owner.fsPath, w.owner.fsPath)) {
                return true;
            }
            return false;
        });
    }

    private create(resource: Resource, mode: InteractiveWindowMode): IInteractiveWindow {
        // Set it as soon as we create it. The .ctor for the interactive window
        // may cause a subclass to talk to the IInteractiveWindowProvider to get the active interactive window.
        const result = this.serviceContainer.get<IInteractiveWindowLoadable>(IInteractiveWindow);
        this._windows.push(result);

        // This is the last interactive window at the moment (as we're about to create it)
        this.lastActiveInteractiveWindow = result;

        // When shutting down, we fire an event
        const handler = result.closed(this.onInteractiveWindowClosed);
        this.disposables.push(result);
        this.disposables.push(handler);
        this.disposables.push(result.onDidChangeViewState(this.raiseOnDidChangeActiveInteractiveWindow.bind(this)));

        const title =
            mode === 'multiple'
                ? localize.DataScience.interactiveWindowTitleFormat().format(`#${this._windows.length}`)
                : undefined;

        // Load in the background
        result.load(resource, mode, title).catch((e) => this.errorHandler.handleError(e));

        return result;
    }

    private raiseOnDidChangeActiveInteractiveWindow() {
        // Update last active window (remember changes to the active window)
        this.lastActiveInteractiveWindow = this.activeWindow ? this.activeWindow : this.lastActiveInteractiveWindow;
        this._onDidChangeActiveInteractiveWindow.fire(this.activeWindow);
    }
    private onPeerCountChanged(newCount: number) {
        // If we're losing peers, resolve all syncs
        if (newCount < this.postOffice.peerCount) {
            this.pendingSyncs.forEach((v) => v.waitable.resolve());
            this.pendingSyncs.clear();
        }
    }

    // tslint:disable-next-line:no-any
    private async onRemoteCreate(...args: any[]) {
        // Should be two args, the originator of the create and the key/resource
        if (args.length > 1 && args[0].toString() !== this.id) {
            // The other side is creating a interactive window. Create on this side. We don't need to show
            // it as the running of new code should do that.
            const owner = Uri.parse(args[2].toString());
            const mode = await this.getInteractiveMode(owner);
            if (!this.get(owner, mode)) {
                this.create(owner, mode);
            }

            // Tell the requestor that we got its message (it should be waiting for all peers to sync)
            this.postOffice.postCommand(LiveShareCommands.interactiveWindowCreateSync, ...args).ignoreErrors();
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

    private onInteractiveWindowClosed = (interactiveWindow: IInteractiveWindow) => {
        this._windows = this._windows.filter((w) => w !== interactiveWindow);
        if (this.lastActiveInteractiveWindow === interactiveWindow) {
            this.lastActiveInteractiveWindow = this._windows[0];
        }
        this.raiseOnDidChangeActiveInteractiveWindow();
    };
}
