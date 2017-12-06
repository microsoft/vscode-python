// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as vscode from 'vscode';
import { JediFactory } from '../languageServices/jediProxyFactory';
import { captureTelemetry } from '../telemetry';
import { COMPLETION } from '../telemetry/constants';
import { CompletionSource } from './completionSource';

export class PythonCompletionItemProvider implements vscode.CompletionItemProvider {
    private completionSource: CompletionSource;

    constructor(jediFactory: JediFactory) {
        this.completionSource = new CompletionSource(jediFactory);
    }

    @captureTelemetry(COMPLETION)
    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CompletionItem[]> {
        return this.completionSource.getVsCodeCompletionItems(document, position, token);
    }

    public async resolveCompletionItem(item: vscode.CompletionItem): Promise<vscode.CompletionItem> {
        item.documentation = await this.completionSource.getDocumentation(item);
        return item;
    }
}
