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

class TestPortAttributesProvider implements PortAttributesProvider {
    private knownPorts: number[] = [];

    public providePortAttributes(
        attributes: { port: number; pid?: number; commandLine?: string },
        _token: CancellationToken,
    ): ProviderResult<PortAttributes> {
        if (this.knownPorts.includes(attributes.port)) {
            return new PortAttributes(PortAutoForwardAction.Ignore);
        }
        return undefined;
    }

    public setPortAttribute(port: number): void {
        this.knownPorts.push(port);
    }

    public resetPortAttribute(port: number): void {
        this.knownPorts = this.knownPorts.filter((p) => p !== port);
    }
}

let provider: TestPortAttributesProvider | undefined;

export function registerTestPortAttributesProvider(disposables: Disposable[]): void {
    provider = new TestPortAttributesProvider();
    disposables.push(workspace.registerPortAttributesProvider({}, provider));
}

export function setPortAttribute(port: number): void {
    provider?.setPortAttribute(port);
}

export function resetPortAttribute(port: number): void {
    provider?.resetPortAttribute(port);
}
