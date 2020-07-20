// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable, named } from 'inversify';
import * as uuid from 'uuid/v4';
import { ConfigurationTarget, Event, EventEmitter, Memento, Uri } from 'vscode';
import * as vsls from 'vsls/vscode';

import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    ILiveShareApi,
    IWebPanelProvider,
    IWorkspaceService
} from '../../common/application/types';
import { UseCustomEditorApi } from '../../common/constants';
import { IFileSystem } from '../../common/platform/types';
import {
    GLOBAL_MEMENTO,
    IAsyncDisposable,
    IAsyncDisposableRegistry,
    IConfigurationService,
    IDisposableRegistry,
    IExperimentService,
    IExperimentsManager,
    IMemento,
    InteractiveWindowMode,
    IPersistentStateFactory,
    Resource,
    WORKSPACE_MEMENTO
} from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { Identifiers, LiveShare, LiveShareCommands } from '../constants';
import { IDataViewerFactory } from '../data-viewing/types';
import { ExportUtil } from '../export/exportUtil';
import { KernelSwitcher } from '../jupyter/kernels/kernelSwitcher';
import { PostOffice } from '../liveshare/postOffice';
import {
    ICodeCssGenerator,
    IDataScienceErrorHandler,
    IInteractiveWindow,
    IInteractiveWindowListener,
    IInteractiveWindowLoadable,
    IInteractiveWindowProvider,
    IJupyterDebugger,
    IJupyterVariableDataProviderFactory,
    IJupyterVariables,
    INotebookExporter,
    INotebookProvider,
    IStatusProvider,
    IThemeFinder
} from '../types';
import { InteractiveWindow } from './interactiveWindow';

interface ISyncData {
    count: number;
    waitable: Deferred<void>;
}

// Export for testing
export const AskedForPerFileSettingKey = 'ds_asked_per_file_interactive';

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
        let result = this.get(resource, mode) as InteractiveWindow;
        if (!result) {
            // No match. Create a new item.
            result = this.create(resource, mode);

            // Wait for monaco ready (it's not really useable until it has a language)
            const readyPromise = createDeferred();
            const disposable = result.ready(() => readyPromise.resolve());

            // Wait for monaco ready
            await readyPromise.promise;
            disposable.dispose();
        }

        // Wait for synchronization in liveshare
        await this.synchronize(result);

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

    protected create(resource: Resource, mode: InteractiveWindowMode): InteractiveWindow {
        const title =
            mode === 'multiple' || (mode === 'perFile' && !resource)
                ? localize.DataScience.interactiveWindowTitleFormat().format(`#${this._windows.length + 1}`)
                : undefined;

        // Set it as soon as we create it. The .ctor for the interactive window
        // may cause a subclass to talk to the IInteractiveWindowProvider to get the active interactive window.
        const result = new InteractiveWindow(
            this.serviceContainer.getAll<IInteractiveWindowListener>(IInteractiveWindowListener),
            this.serviceContainer.get<ILiveShareApi>(ILiveShareApi),
            this.serviceContainer.get<IApplicationShell>(IApplicationShell),
            this.serviceContainer.get<IDocumentManager>(IDocumentManager),
            this.serviceContainer.get<IStatusProvider>(IStatusProvider),
            this.serviceContainer.get<IWebPanelProvider>(IWebPanelProvider),
            this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry),
            this.serviceContainer.get<ICodeCssGenerator>(ICodeCssGenerator),
            this.serviceContainer.get<IThemeFinder>(IThemeFinder),
            this.serviceContainer.get<IFileSystem>(IFileSystem),
            this.serviceContainer.get<IConfigurationService>(IConfigurationService),
            this.serviceContainer.get<ICommandManager>(ICommandManager),
            this.serviceContainer.get<INotebookExporter>(INotebookExporter),
            this.serviceContainer.get<IWorkspaceService>(IWorkspaceService),
            this,
            this.serviceContainer.get<IDataViewerFactory>(IDataViewerFactory),
            this.serviceContainer.get<IJupyterVariableDataProviderFactory>(IJupyterVariableDataProviderFactory),
            this.serviceContainer.get<IJupyterVariables>(IJupyterVariables, Identifiers.ALL_VARIABLES),
            this.serviceContainer.get<IJupyterDebugger>(IJupyterDebugger),
            this.serviceContainer.get<IDataScienceErrorHandler>(IDataScienceErrorHandler),
            this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory),
            this.serviceContainer.get<Memento>(IMemento, GLOBAL_MEMENTO),
            this.serviceContainer.get<Memento>(IMemento, WORKSPACE_MEMENTO),
            this.serviceContainer.get<IExperimentsManager>(IExperimentsManager),
            this.serviceContainer.get<KernelSwitcher>(KernelSwitcher),
            this.serviceContainer.get<INotebookProvider>(INotebookProvider),
            this.serviceContainer.get<boolean>(UseCustomEditorApi),
            this.serviceContainer.get<IExperimentService>(IExperimentService),
            this.serviceContainer.get<ExportUtil>(ExportUtil),
            resource,
            mode,
            title
        );
        this._windows.push(result);

        // This is the last interactive window at the moment (as we're about to create it)
        this.lastActiveInteractiveWindow = result;

        // When shutting down, we fire an event
        const handler = result.closed(this.onInteractiveWindowClosed);
        this.disposables.push(result);
        this.disposables.push(handler);
        this.disposables.push(result.onDidChangeViewState(this.raiseOnDidChangeActiveInteractiveWindow.bind(this)));

        // Show in the background
        result.show().ignoreErrors();

        return result;
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
        // Should be 3 args, the originator of the create, the key, and the owner. Key isn't used here
        // but it is passed through to the response.
        if (args.length > 1 && args[0].toString() !== this.id) {
            // The other side is creating a interactive window. Create on this side. We don't need to show
            // it as the running of new code should do that.
            const owner = args[2] ? Uri.parse(args[2].toString()) : undefined;
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
        // Should be 3 args, the originator of the create, the key, and the owner (owner used on other call)
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
