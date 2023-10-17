/* eslint-disable class-methods-use-this */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    CancellationToken,
    Disposable,
    PortAttributes,
    PortAttributesProvider,
    PortAutoForwardAction,
    ProviderResult,
    workspace,
} from 'vscode';

export class TestPortAttributesProvider implements PortAttributesProvider {
    public providePortAttributes(
        _attributes: { port: number; pid?: number; commandLine?: string },
        _token: CancellationToken,
    ): ProviderResult<PortAttributes> {
        return new PortAttributes(PortAutoForwardAction.Ignore);
    }
}

export function registerTestPortAttributesProvider(disposables: Disposable[]): void {
    const provider = new TestPortAttributesProvider();
    disposables.push(workspace.registerPortAttributesProvider({}, provider));
}
