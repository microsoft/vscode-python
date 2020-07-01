// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as vscode from 'vscode';
import * as localize from '../common/utils/localize';
import { IJupyterServerUri, IJupyterUriProvider, JupyterServerUriHandle } from './types';

/**
 * This class wraps an IJupyterUriProvider provided by another extension. It allows us to show
 * extra data on the other extension's UI.
 */
export class JupyterUriProviderWrapper implements IJupyterUriProvider {
    constructor(private readonly provider: IJupyterUriProvider, private packageName: string) {}
    public get id() {
        return this.provider.id;
    }
    public getQuickPickEntryItems(): vscode.QuickPickItem[] {
        return this.provider.getQuickPickEntryItems().map((q) => {
            return {
                ...q,
                // Add the package name onto the description
                description: localize.DataScience.uriProviderDescriptionFormat().format(
                    q.description || '',
                    this.packageName
                ),
                original: q
            };
        });
    }
    public handleQuickPick(
        item: vscode.QuickPickItem,
        back: boolean
    ): Promise<JupyterServerUriHandle | 'back' | undefined> {
        // tslint:disable-next-line: no-any
        if ((item as any).original) {
            // tslint:disable-next-line: no-any
            return this.provider.handleQuickPick((item as any).original, back);
        }
        return this.provider.handleQuickPick(item, back);
    }

    public getServerUri(handle: JupyterServerUriHandle): Promise<IJupyterServerUri> {
        return this.provider.getServerUri(handle);
    }
}
