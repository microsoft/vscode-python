// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import { IExtensions } from '../common/types';
import * as localize from '../common/utils/localize';
import {
    IJupyterServerUri,
    IJupyterUriProvider,
    IJupyterUriProviderRegistration,
    JupyterServerUriHandle
} from './types';

@injectable()
export class JupyterUriProviderRegistration implements IJupyterUriProviderRegistration {
    private loadedOtherExtensionsPromise: Promise<void> | undefined;
    private providers = new Map<string, IJupyterUriProvider>();

    constructor(@inject(IExtensions) private readonly extensions: IExtensions) {}

    public async getProviders(): Promise<ReadonlyArray<IJupyterUriProvider>> {
        await this.checkOtherExtensions();

        // Other extensions should have registered in their activate callback
        return [...this.providers.values()];
    }

    public registerProvider(provider: IJupyterUriProvider) {
        if (!this.providers.has(provider.id)) {
            this.providers.set(provider.id, provider);
        } else {
            throw new Error(`IJupyterUriProvider already exists with id ${provider.id}`);
        }
    }

    public async getJupyterServerUri(id: string, handle: JupyterServerUriHandle): Promise<IJupyterServerUri> {
        await this.checkOtherExtensions();

        const provider = this.providers.get(id);
        if (provider) {
            return provider.getServerUri(handle);
        }
        throw new Error(localize.DataScience.unknownServerUri());
    }

    private checkOtherExtensions(): Promise<void> {
        if (!this.loadedOtherExtensionsPromise) {
            this.loadedOtherExtensionsPromise = this.loadOtherExtensions();
        }
        return this.loadedOtherExtensionsPromise;
    }

    private async loadOtherExtensions(): Promise<void> {
        const list = this.extensions.all
            .filter((e) => e.packageJSON?.contributes?.pythonRemoteServerProvider)
            .map((e) => (e.isActive ? Promise.resolve() : e.activate()));
        await Promise.all(list);
    }
}
