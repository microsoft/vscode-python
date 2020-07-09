// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as uuid from 'uuid/v4';
import { Disposable, Event, EventEmitter, Uri } from 'vscode';
import * as vsls from 'vsls/vscode';

import { ILiveShareApi } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IAsyncDisposable, IAsyncDisposableRegistry, IDisposableRegistry, Resource } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
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

const UnownedKeyScheme = 'guid-key';

@injectable()
export class InteractiveWindowProvider implements IInteractiveWindowProvider, IAsyncDisposable {
    public get onDidChangeActiveInteractiveWindow(): Event<IInteractiveWindow | undefined> {
        return this._onDidChangeActiveInteractiveWindow.event;
    }
    public get activeWindow(): IInteractiveWindow | undefined {
        return this.activeInteractiveWindow;
    }
    public get windows(): ReadonlyArray<IInteractiveWindow> {
        return this._windows;
    }
    private readonly _onDidChangeActiveInteractiveWindow = new EventEmitter<IInteractiveWindow | undefined>();
    private activeInteractiveWindow: IInteractiveWindow | undefined;
    private postOffice: PostOffice;
    private id: string;
    private pendingSyncs: Map<string, ISyncData> = new Map<string, ISyncData>();
    private activeInteractiveWindowExecuteHandler: Disposable | undefined;
    private _windows: IInteractiveWindow[] = [];
    constructor(
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem,
        @inject(IDataScienceErrorHandler) private readonly errorHandler: IDataScienceErrorHandler
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
        // See if we already have a match
        let result = this.get(resource);
        if (!result) {
            // No match. Create a new item.
            result = this.create(resource);

            // Wait for synchronization in liveshare
            await this.synchronizeCreate(resource);
        }
        return result;
    }

    public dispose(): Promise<void> {
        return this.postOffice.dispose();
    }

    private get(owner: Resource): IInteractiveWindow | undefined {
        return this._windows.find((w) => {
            if (!owner && !w.owner) {
                return true;
            }
            if (owner && w.owner && this.fileSystem.arePathsSame(owner.fsPath, w.owner.fsPath)) {
                return true;
            }
            if (owner && !w.owner) {
                return true; // This is the case where there's an unowned window
            }
            return false;
        });
    }

    private create(resource: Resource): IInteractiveWindow {
        // Set it as soon as we create it. The .ctor for the interactive window
        // may cause a subclass to talk to the IInteractiveWindowProvider to get the active interactive window.
        const result = this.serviceContainer.get<IInteractiveWindowLoadable>(IInteractiveWindow);
        this._windows.push(result);
        this.activeInteractiveWindow = result;

        // When shutting down, we fire an event
        const handler = this.activeInteractiveWindow.closed(this.onInteractiveWindowClosed);
        this.disposables.push(this.activeInteractiveWindow);
        this.disposables.push(handler);
        this.disposables.push(
            this.activeInteractiveWindow.onDidChangeViewState(this.raiseOnDidChangeActiveInteractiveWindow.bind(this))
        );

        // Load in the background
        result
            .load(resource)
            .then(() => this.raiseOnDidChangeActiveInteractiveWindow())
            .catch((e) => this.errorHandler.handleError(e));

        return this.activeInteractiveWindow;
    }

    private raiseOnDidChangeActiveInteractiveWindow() {
        // Find the active window
        this.activeInteractiveWindow = this._windows.find((w) => (w.active && w.visible ? true : false));
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
            const key = Uri.parse(args[1].toString());
            const resource = key.scheme === UnownedKeyScheme ? undefined : key;
            if (!this.get(resource)) {
                this.create(resource);
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
        if (this.activeInteractiveWindow === interactiveWindow) {
            this.activeInteractiveWindow = undefined;
            if (this.activeInteractiveWindowExecuteHandler) {
                this.activeInteractiveWindowExecuteHandler.dispose();
                this.activeInteractiveWindowExecuteHandler = undefined;
            }
        }
        this._windows = this._windows.filter((w) => w !== interactiveWindow);
        this.raiseOnDidChangeActiveInteractiveWindow();
    };

    private async synchronizeCreate(owner: Resource): Promise<void> {
        // Create a new pending wait if necessary
        if (this.postOffice.peerCount > 0 || this.postOffice.role === vsls.Role.Guest) {
            const key = owner ? owner.toString() : Uri.parse(`${UnownedKeyScheme}://${uuid}`).toString();
            const waitable = createDeferred<void>();
            this.pendingSyncs.set(key, { count: this.postOffice.peerCount, waitable });

            // Make sure all providers have an active interactive window
            await this.postOffice.postCommand(LiveShareCommands.interactiveWindowCreate, this.id, key);

            // Wait for the waitable to be signaled or the peer count on the post office to change
            await waitable.promise;
        }
    }
}
