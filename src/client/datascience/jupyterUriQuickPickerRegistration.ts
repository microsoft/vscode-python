// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import { IExtensions } from '../common/types';
import {
    IJupyterServerUri,
    IJupyterUriQuickPicker,
    IJupyterUriQuickPickerRegistration,
    JupyterServerUriHandle
} from './types';

@injectable()
export class JupyterUriQuickPickerRegistration implements IJupyterUriQuickPickerRegistration {
    private loadedOtherExtensionsPromise: Promise<void> | undefined;
    private pickerList: IJupyterUriQuickPicker[] = [];

    constructor(@inject(IExtensions) private readonly extensions: IExtensions) {}

    public async getPickers(): Promise<ReadonlyArray<IJupyterUriQuickPicker>> {
        await this.checkOtherExtensions();

        // Other extensions should have registered in their activate callback
        return this.pickerList;
    }

    public registerPicker(provider: IJupyterUriQuickPicker) {
        this.pickerList.push(provider);
    }

    public getJupyterServerUri(id: string, handle: JupyterServerUriHandle): Promise<IJupyterServerUri> {
        const picker = this.pickerList.find((p) => p.id === id);
        if (picker) {
            return picker.getServerUri(handle);
        }
        throw new Error('Unknown server picker');
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
