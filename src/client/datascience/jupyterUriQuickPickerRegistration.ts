// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { injectable } from 'inversify';
import * as vscode from 'vscode';
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
        const list = vscode.extensions.all
            .filter((e) => e.packageJSON?.contributes?.pythonRemoteServerProvider)
            .map((e) => (e.isActive ? Promise.resolve() : e.activate()));
        await Promise.all(list);
    }
}
