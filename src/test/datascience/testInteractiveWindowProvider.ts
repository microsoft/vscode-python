// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import { Event } from 'vscode';

import { ILiveShareApi } from '../../client/common/application/types';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry } from '../../client/common/types';
import { InteractiveWindowMessageListener } from '../../client/datascience/interactive-common/interactiveWindowMessageListener';
import { InteractiveWindowMessages } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { InteractiveWindow } from '../../client/datascience/interactive-window/interactiveWindow';
import { InteractiveWindowProvider } from '../../client/datascience/interactive-window/interactiveWindowProvider';
import { IInteractiveWindow, IInteractiveWindowProvider, INotebookServerOptions } from '../../client/datascience/types';
import { IServiceContainer } from '../../client/ioc/types';

@injectable()
export class TestInteractiveWindowProvider implements IInteractiveWindowProvider {
    public get onDidChangeActiveInteractiveWindow() {
        return this.realProvider.onDidChangeActiveInteractiveWindow;
    }
    private realProvider: InteractiveWindowProvider;
    constructor(
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IAsyncDisposableRegistry) asyncRegistry: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(IConfigurationService) configService: IConfigurationService
    ) {
        this.realProvider = new InteractiveWindowProvider(
            liveShare,
            serviceContainer,
            asyncRegistry,
            disposables,
            configService
        );

        // During a test, the 'create' function will end up being called during a live share. We need to hook its result too
        // so just hook the 'create' function to fix all callers.
        // tslint:disable-next-line: no-any
        const fungible = this.realProvider as any;
        const origCreate = fungible.create.bind(fungible);
        fungible.create = async () => {
            const result = await origCreate();
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

    public getActive(): IInteractiveWindow | undefined {
        return this.realProvider.getActive();
    }

    public get onExecutedCode(): Event<string> {
        return this.realProvider.onExecutedCode;
    }

    public async getOrCreateActive(): Promise<IInteractiveWindow> {
        return this.realProvider.getOrCreateActive();
    }

    public getNotebookOptions(): Promise<INotebookServerOptions> {
        return this.realProvider.getNotebookOptions();
    }
}
