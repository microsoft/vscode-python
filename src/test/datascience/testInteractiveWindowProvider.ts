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
    InteractiveWindowMode,
    Resource
} from '../../client/common/types';
import { InteractiveWindowMessageListener } from '../../client/datascience/interactive-common/interactiveWindowMessageListener';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { InteractiveWindow } from '../../client/datascience/interactive-window/interactiveWindow';
import { InteractiveWindowProvider } from '../../client/datascience/interactive-window/interactiveWindowProvider';
import { IInteractiveWindow, IInteractiveWindowProvider } from '../../client/datascience/types';
import { IServiceContainer } from '../../client/ioc/types';
import { DataScienceIocContainer } from './dataScienceIocContainer';
import { IMountedWebView } from './mountedWebView';
import { mountConnectedMainPanel } from './testHelpers';

export interface ITestInteractiveWindowProvider extends IInteractiveWindowProvider {
    getMountedWebView(window: IInteractiveWindow | undefined): IMountedWebView;
}

@injectable()
export class TestInteractiveWindowProvider extends InteractiveWindowProvider implements ITestInteractiveWindowProvider {
    private windowToMountMap = new Map<string, IMountedWebView>();
    constructor(
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(IFileSystem) fileSystem: IFileSystem,
        @inject(IConfigurationService) configService: IConfigurationService,
        @inject(IMemento) @named(GLOBAL_MEMENTO) globalMemento: Memento,
        @inject(IApplicationShell) appShell: IApplicationShell,
        @inject(DataScienceIocContainer) private readonly ioc: DataScienceIocContainer
    ) {
        super(
            liveShare,
            serviceContainer,
            asyncRegistry,
            disposables,
            fileSystem,
            configService,
            globalMemento,
            appShell
        );
    }

    public getMountedWebView(window: IInteractiveWindow | undefined): IMountedWebView {
        const key = window ? window.identity.toString() : this.windows[0].identity.toString();
        if (!this.windowToMountMap.has(key)) {
            throw new Error('Test Failure: Window not mounted yet.');
        }
        return this.windowToMountMap.get(key)!;
    }

    protected create(resource: Resource, mode: InteractiveWindowMode): IInteractiveWindow {
        // Generate the mount wrapper using a custom id
        const id = uuid();
        const mounted = this.ioc.createWebView(() => mountConnectedMainPanel('interactive'), id);

        // Call the real create
        const result = super.create(resource, mode);

        // Associate the real create with our id in order to find the wrapper
        this.windowToMountMap.set(result.identity.toString(), mounted);

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
