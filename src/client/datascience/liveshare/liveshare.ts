// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as vsls from 'vsls/vscode';

import { IApplicationShell, ILiveShareApi, IWorkspaceService } from '../../common/application/types';
import { IConfigurationService, IDisposableRegistry } from '../../common/types';
import { LiveShareProxy } from './liveshareProxy';

// tslint:disable:no-any unified-signatures

@injectable()
export class LiveShareApi implements ILiveShareApi {
    private supported: boolean = false;
    private apiPromise: Promise<vsls.LiveShare | null> | undefined;
    private disposed: boolean = false;

    constructor(
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IWorkspaceService) workspace: IWorkspaceService,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(IApplicationShell) private appShell: IApplicationShell
    ) {
        const disposable = workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('python.dataScience', undefined)) {
                // When config changes happen, recreate our commands.
                this.onSettingsChanged();
            }
        });
        disposableRegistry.push(disposable);
        disposableRegistry.push(this);
        this.onSettingsChanged();
    }

    public dispose(): void {
        this.disposed = true;
    }

    public getApi(): Promise<vsls.LiveShare | null> {
        if (this.disposed) {
            return Promise.resolve(null);
        }
        return this.apiPromise!;
    }

    private onSettingsChanged() {
        const supported = this.configService.getSettings().datascience.allowLiveShare;
        if (supported !== this.supported) {
            this.supported = supported ? true : false;
            const liveShareTimeout = this.configService.getSettings().datascience.liveShareConnectionTimeout;
            this.apiPromise = supported
                ? vsls.getApi().then(a => (a ? new LiveShareProxy(this.appShell, liveShareTimeout, a) : a))
                : Promise.resolve(null);
        } else if (!this.apiPromise) {
            this.apiPromise = Promise.resolve(null);
        }
    }
}
