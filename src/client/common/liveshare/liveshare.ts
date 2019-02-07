// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-any unified-signatures

import { injectable, inject } from 'inversify';
import { ILiveShareApi, IWorkspaceService } from '../application/types';
import * as vsls from 'vsls/vscode';
import { IConfigurationService, IDisposableRegistry } from '../types';


@injectable()
export class LiveShareApi implements ILiveShareApi {

    private supported : boolean = false;
    private apiPromise : Promise<vsls.LiveShare | null>;

    constructor(
        @inject(IDisposableRegistry) disposableRegistry : IDisposableRegistry,
        @inject(IWorkspaceService) workspace : IWorkspaceService,
        @inject(IConfigurationService) private configService : IConfigurationService
        ) {
        const disposable = workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('python.dataScience', undefined)) {
                // When config changes happen, recreate our commands.
                this.onSettingsChanged();
            }
        });
        disposableRegistry.push(disposable);
        this.onSettingsChanged();
    }

    public getApi(): Promise<vsls.LiveShare | null> {
        return this.apiPromise;
    }

    private onSettingsChanged() {
        const supported = this.configService.getSettings().datascience.allowLiveShare;
        if (supported != this.supported) {
            this.apiPromise = supported ? vsls.getApi() : Promise.resolve(null);
        }
    }
}
