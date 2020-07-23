// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable, named } from 'inversify';
import * as uuid from 'uuid/v4';
import { Memento, Uri } from 'vscode';
import { IApplicationShell, ILiveShareApi } from '../../client/common/application/types';
import {
    GLOBAL_MEMENTO,
    IAsyncDisposableRegistry,
    IConfigurationService,
    IDisposableRegistry,
    IMemento,
    InteractiveWindowMode,
    Resource
} from '../../client/common/types';
import { createDeferred, Deferred } from '../../client/common/utils/async';
import { InteractiveWindowMessageListener } from '../../client/datascience/interactive-common/interactiveWindowMessageListener';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { resetIdentity } from '../../client/datascience/interactive-window/identity';
import { InteractiveWindow } from '../../client/datascience/interactive-window/interactiveWindow';
import { InteractiveWindowProvider } from '../../client/datascience/interactive-window/interactiveWindowProvider';
import { IDataScienceFileSystem, IInteractiveWindow, IInteractiveWindowProvider } from '../../client/datascience/types';
import { IServiceContainer } from '../../client/ioc/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { IMountedWebView } from './mountedWebView';
import { mountConnectedMainPanel } from './testHelpers';
import { WaitForMessageOptions } from './uiTests/helpers';

export interface ITestInteractiveWindowProvider extends IInteractiveWindowProvider {
    getMountedWebView(window: IInteractiveWindow | undefined): IMountedWebView;
    waitForMessage(identity: Uri | undefined, message: string, options?: WaitForMessageOptions): Promise<void>;
}

@injectable()
export class TestInteractiveWindowProvider extends InteractiveWindowProvider implements ITestInteractiveWindowProvider {
    private windowToMountMap = new Map<string, IMountedWebView>();
    private pendingMessageWaits: {
        message: string;
        options?: WaitForMessageOptions;
        deferred: Deferred<void>;
    }[] = [];

    constructor(
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(IServiceContainer) private readonly container: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(IDataScienceFileSystem) fileSystem: IDataScienceFileSystem,
        @inject(IConfigurationService) configService: IConfigurationService,
        @inject(IMemento) @named(GLOBAL_MEMENTO) globalMemento: Memento,
        @inject(IApplicationShell) appShell: IApplicationShell
    ) {
        super(liveShare, container, asyncRegistry, disposables, fileSystem, configService, globalMemento, appShell);

        // Reset our identity IDs when we create a new TestInteractiveWindowProvider
        resetIdentity();
    }

    public getMountedWebView(window: IInteractiveWindow | undefined): IMountedWebView {
        const key = window ? window.identity.toString() : this.windows[0]?.identity.toString();
        if (!this.windowToMountMap.has(key)) {
            throw new Error('Test Failure: Window not mounted yet.');
        }
        return this.windowToMountMap.get(key)!;
    }

    public waitForMessage(identity: Uri | undefined, message: string, options?: WaitForMessageOptions): Promise<void> {
        // We may already have this editor. Check. Undefined may also match.
        const key = identity ? identity.toString() : this.windows[0] ? this.windows[0].identity.toString() : undefined;
        if (key && this.windowToMountMap.has(key)) {
            return this.windowToMountMap.get(key)!.waitForMessage(message, options);
        }

        // Otherwise pend for the next create.
        this.pendingMessageWaits.push({ message, options, deferred: createDeferred() });
        return this.pendingMessageWaits[this.pendingMessageWaits.length - 1].deferred.promise;
    }

    protected create(resource: Resource, mode: InteractiveWindowMode): InteractiveWindow {
        // Generate the mount wrapper using a custom id
        const id = uuid();
        const mounted = this.container
            .get<DataScienceIocContainer>(DataScienceIocContainer)
            .createWebView(() => mountConnectedMainPanel('interactive'), id);

        // Might have a pending wait for message
        if (this.pendingMessageWaits.length) {
            const list = [...this.pendingMessageWaits];
            this.pendingMessageWaits = [];
            list.forEach((p) => {
                mounted
                    .waitForMessage(p.message, p.options)
                    .then(() => {
                        p.deferred.resolve();
                    })
                    .catch((e) => p.deferred.reject(e));
            });
        }

        // Call the real create
        const result = super.create(resource, mode);

        // Associate the real create with our id in order to find the wrapper
        const key = result.identity.toString();
        this.windowToMountMap.set(key, mounted);
        mounted.onDisposed(() => this.windowToMountMap.delete(key));

        // During testing the MainPanel sends the init message before our interactive window is created.
        // Pretend like it's happening now
        // tslint:disable-next-line: no-any
        const listener = (result as any).messageListener as InteractiveWindowMessageListener;
        listener.onMessage(InteractiveWindowMessages.Started, {});

        // Also need the css request so that other messages can go through
        const webHost = result as InteractiveWindow;
        webHost.setTheme(false);

        return result;
    }
}
