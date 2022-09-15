// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Disposable } from 'vscode';
import { Commands } from '../../common/constants';
import { IDisposableRegistry } from '../../common/types';
import { registerCommand } from '../../common/vscodeApis/commandApis';
import { IDiscoveryAPI } from '../base/locator';
import { handleCreateEnvironmentCommand } from './createEnvQuickPick';
import { condaCreationProvider } from './provider/condaCreationProvider';
import { VenvCreationProvider } from './provider/venvCreationProvider';
import { CreateEnvironmentOptions, CreateEnvironmentProvider } from './types';

class CreateEnvironmentProviders {
    private _createEnvProviders: CreateEnvironmentProvider[] = [];

    constructor() {
        this._createEnvProviders = [];
    }

    public add(provider: CreateEnvironmentProvider) {
        this._createEnvProviders.push(provider);
    }

    public remove(provider: CreateEnvironmentProvider) {
        this._createEnvProviders = this._createEnvProviders.filter((p) => p !== provider);
    }

    public getAll(): readonly CreateEnvironmentProvider[] {
        return this._createEnvProviders;
    }
}

const _createEnvironmentProviders: CreateEnvironmentProviders = new CreateEnvironmentProviders();

export function registerCreateEnvironmentProvider(provider: CreateEnvironmentProvider): Disposable {
    _createEnvironmentProviders.add(provider);
    return new Disposable(() => {
        _createEnvironmentProviders.remove(provider);
    });
}

export function registerCreateEnvironmentFeatures(disposables: IDisposableRegistry, discoveryApi: IDiscoveryAPI): void {
    disposables.push(
        registerCommand(Commands.Create_Environment, async (options?: CreateEnvironmentOptions) => {
            const providers = _createEnvironmentProviders.getAll();
            await handleCreateEnvironmentCommand(providers, options);
        }),
    );
    disposables.push(registerCreateEnvironmentProvider(new VenvCreationProvider(discoveryApi)));
    disposables.push(registerCreateEnvironmentProvider(condaCreationProvider()));
}
