// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable, named } from 'inversify';
import * as uuid from 'uuid/v4';
import { Memento } from 'vscode';
import { IApplicationShell, ILiveShareApi } from '../../client/common/application/types';
import { IFileSystem } from '../../client/common/platform/types';
import {
    GLOBAL_MEMENTO,
    IAsyncDisposableRegistry,
    IConfigurationService,
    IDisposableRegistry,
    IMemento,
    Resource,
    InteractiveWindowMode
} from '../../client/common/types';
import { InteractiveWindowMessageListener } from '../../client/datascience/interactive-common/interactiveWindowMessageListener';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { InteractiveWindow } from '../../client/datascience/interactive-window/interactiveWindow';
import { InteractiveWindowProvider } from '../../client/datascience/interactive-window/interactiveWindowProvider';
import {
    IDataScienceErrorHandler,
    IInteractiveWindow,
    IInteractiveWindowProvider
} from '../../client/datascience/types';
import { IServiceContainer } from '../../client/ioc/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { mountConnectedMainPanel } from './testHelpers';
import { IMountedWebView } from './mountedWebView';

export interface ITestInteractiveWindowProvider {
    getMountedWebView(window: IInteractiveWindow): IMountedWebView;
}

@injectable()
export class TestInteractiveWindowProvider implements IInteractiveWindowProvider, ITestInteractiveWindowProvider {
    public get onDidChangeActiveInteractiveWindow() {
        return this.realProvider.onDidChangeActiveInteractiveWindow;
    }
    private realProvider: InteractiveWindowProvider;
    private windowToMountMap = new Map<string, string>();
    constructor(
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(IFileSystem) readonly fileSystem: IFileSystem,
        @inject(IDataScienceErrorHandler) readonly errorHandler: IDataScienceErrorHandler,
        @inject(IConfigurationService) readonly configService: IConfigurationService,
        @inject(IMemento) @named(GLOBAL_MEMENTO) readonly globalMemento: Memento,
        @inject(IApplicationShell) readonly appShell: IApplicationShell,
        @inject(DataScienceIocContainer) readonly ioc: DataScienceIocContainer
    ) {
        this.realProvider = new InteractiveWindowProvider(
            liveShare,
            serviceContainer,
            asyncRegistry,
            disposables,
            fileSystem,
            errorHandler,
            configService,
            globalMemento,
            appShell
        );

        // During a test, the 'create' function will end up being called during a live share. We need to hook its result too
        // so just hook the 'create' function to fix all callers.
        // tslint:disable-next-line: no-any
        const fungible = this.realProvider as any;
        const origCreate = fungible.create.bind(fungible);
        fungible.create = (resource: Resource, mode: InteractiveWindowMode) => {
            // Generate the mount wrapper using a custom id
            const id = uuid();
            this.ioc.createWebView(() => mountConnectedMainPanel('interactive'), id);

            // Call the real create.
            const result = origCreate(resource, mode);

            // Associate the real create with our id in order to find the wrapper
            this.windowToMountMap.set(result.identity.toString(), id);

            // During testing the MainPanel sends the init message before our interactive window is created.
            // Pretend like it's happening now
            // tslint:disable-next-line: no-any
            const listener = (result as any).messageListener as InteractiveWindowMessageListener;
            listener.onMessage(InteractiveWindowMessages.Started, {});

            // Also need the css request so that other messages can go through
            const webHost = result as InteractiveWindow;
            webHost.setTheme(false);

            return result;
        };
    }

    public get activeWindow(): IInteractiveWindow | undefined {
        return this.realProvider.activeWindow;
    }

    public get windows(): ReadonlyArray<IInteractiveWindow> {
        return this.realProvider.windows;
    }

    public synchronize(window: IInteractiveWindow): Promise<void> {
        return this.realProvider.synchronize(window);
    }

    public getOrCreate(resource: Resource): Promise<IInteractiveWindow> {
        return this.realProvider.getOrCreate(resource);
    }

    public getMountedWebView(window: IInteractiveWindow | undefined): IMountedWebView {
        const key = window ? window.identity.toString() : this.windows[0].identity.toString();
        if (!this.windowToMountMap.has(key)) {
            throw new Error('Test Failure: Window not mounted yet.');
        }
        return this.ioc.getWebPanel(this.windowToMountMap.get(key)!);
    }
}
