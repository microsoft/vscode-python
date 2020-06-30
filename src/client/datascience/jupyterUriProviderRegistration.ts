// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import * as path from 'path';
import { IFileSystem } from '../common/platform/types';
import { IExtensions } from '../common/types';
import * as localize from '../common/utils/localize';
import { EXTENSION_ROOT_DIR } from '../constants';
import { JupyterUriProviderWrapper } from './jupyterUriProviderWrapper';
import {
    IJupyterServerUri,
    IJupyterUriProvider,
    IJupyterUriProviderRegistration,
    JupyterServerUriHandle
} from './types';

@injectable()
export class JupyterUriProviderRegistration implements IJupyterUriProviderRegistration {
    private loadedOtherExtensionsPromise: Promise<void> | undefined;
    private providers = new Map<string, Promise<IJupyterUriProvider>>();

    constructor(
        @inject(IExtensions) private readonly extensions: IExtensions,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem
    ) {}

    public async getProviders(): Promise<ReadonlyArray<IJupyterUriProvider>> {
        await this.checkOtherExtensions();

        // Other extensions should have registered in their activate callback
        return Promise.all([...this.providers.values()]);
    }

    public registerProvider(provider: IJupyterUriProvider) {
        if (!this.providers.has(provider.id)) {
            this.providers.set(provider.id, this.createProvider(provider));
        } else {
            throw new Error(`IJupyterUriProvider already exists with id ${provider.id}`);
        }
    }

    public async getJupyterServerUri(id: string, handle: JupyterServerUriHandle): Promise<IJupyterServerUri> {
        await this.checkOtherExtensions();

        const providerPromise = this.providers.get(id);
        if (providerPromise) {
            const provider = await providerPromise;
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

    private async createProvider(provider: IJupyterUriProvider): Promise<IJupyterUriProvider> {
        const packageName = await this.determineExtensionFromCallstack();
        return new JupyterUriProviderWrapper(provider, packageName);
    }

    private async determineExtensionFromCallstack(): Promise<string> {
        const stack = new Error().stack;
        if (stack) {
            const root = EXTENSION_ROOT_DIR.toLowerCase();
            const frames = stack.split('\n').map((f) => {
                const result = /\((.*)\)/.exec(f);
                if (result) {
                    return result[1];
                }
            });
            for (const frame of frames) {
                if (frame && !frame.startsWith(root)) {
                    // This file is from a different extension. Try to find its package.json
                    let dirName = path.dirname(frame);
                    let last = frame;
                    while (dirName && dirName.length < last.length) {
                        const possiblePackageJson = path.join(dirName, 'package.json');
                        if (await this.fileSystem.fileExists(possiblePackageJson)) {
                            const text = await this.fileSystem.readFile(possiblePackageJson);
                            try {
                                const json = JSON.parse(text);
                                return `${json.publisher}.${json.name}`;
                            } catch {
                                // If parse fails, then not the extension
                            }
                        }
                        last = dirName;
                        dirName = path.dirname(dirName);
                    }
                }
            }
        }
        return localize.DataScience.unknownPackage();
    }
}
