// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as vscode from 'vscode';
import { IConfigurationService } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { JediFactory } from '../languageServices/jediProxyFactory';
import { IItemInfoSource, LanguageItemInfo } from './itemInfoSource';
import * as proxy from './jediProxy';
import { isPositionInsideStringOrComment } from './providerUtilities';

class DocumentPosition {
    constructor(public document: vscode.TextDocument, public position: vscode.Position) {}

    public static fromObject(item: object): DocumentPosition {
        // tslint:disable-next-line:no-any
        return (item as any)._documentPosition as DocumentPosition;
    }

    public attachTo(item: object): void {
        // tslint:disable-next-line:no-any
        (item as any)._documentPosition = this;
    }
}

export class CompletionSource {
    private jediFactory: JediFactory;

    constructor(
        jediFactory: JediFactory,
        private serviceContainer: IServiceContainer,
        private itemInfoSource: IItemInfoSource
    ) {
        this.jediFactory = jediFactory;
    }

    public async getVsCodeCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.CompletionItem[]> {
        const result = await this.getCompletionResult(document, position, token);
        if (result === undefined) {
            return Promise.resolve([]);
        }
        return this.toVsCodeCompletions(new DocumentPosition(document, position), result, document.uri);
    }

    public async getDocumentation(
        completionItem: vscode.CompletionItem,
        token: vscode.CancellationToken
    ): Promise<LanguageItemInfo[] | undefined> {
        const documentPosition = DocumentPosition.fromObject(completionItem);
        if (documentPosition === undefined) {
            return;
        }

        // Supply hover source with simulated document text where item in question was 'already typed'.
        const document = documentPosition.document;
        const position = documentPosition.position;
        const wordRange = document.getWordRangeAtPosition(position);

        const leadingRange =
            wordRange !== undefined
                ? new vscode.Range(new vscode.Position(0, 0), wordRange.start)
                : new vscode.Range(new vscode.Position(0, 0), position);

        const itemString = completionItem.label;
        const sourceText = `${document.getText(leadingRange)}${itemString}`;
        const range = new vscode.Range(leadingRange.end, leadingRange.end.translate(0, itemString.length));

        return this.itemInfoSource.getItemInfoFromText(document.uri, document.fileName, range, sourceText, token);
    }

    private async getCompletionResult(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<proxy.ICompletionResult | undefined> {
        if (position.character <= 0 || isPositionInsideStringOrComment(document, position)) {
            return undefined;
        }

        const type = proxy.CommandType.Completions;
        const columnIndex = position.character;

        const source = document.getText();
        const cmd: proxy.ICommand = {
            command: type,
            fileName: document.fileName,
            columnIndex: columnIndex,
            lineIndex: position.line,
            source: source
        };

        return this.jediFactory.getJediProxyHandler<proxy.ICompletionResult>(document.uri).sendCommand(cmd, token);
    }

    private toVsCodeCompletions(
        documentPosition: DocumentPosition,
        data: proxy.ICompletionResult,
        resource: vscode.Uri
    ): vscode.CompletionItem[] {
        return data && data.items.length > 0
            ? data.items.map(item => this.toVsCodeCompletion(documentPosition, item, resource))
            : [];
    }

    private toVsCodeCompletion(
        documentPosition: DocumentPosition,
        item: proxy.IAutoCompleteItem,
        resource: vscode.Uri
    ): vscode.CompletionItem {
        const completionItem = new vscode.CompletionItem(item.text);
        completionItem.kind = item.type;
        const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const pythonSettings = configurationService.getSettings(resource);
        if (
            pythonSettings.autoComplete.addBrackets === true &&
            (item.kind === vscode.SymbolKind.Function || item.kind === vscode.SymbolKind.Method)
        ) {
            completionItem.insertText = new vscode.SnippetString(item.text)
                .appendText('(')
                .appendTabstop()
                .appendText(')');
        }
        // Ensure the built in members are at the bottom.
        completionItem.sortText =
            (completionItem.label.startsWith('__') ? 'z' : completionItem.label.startsWith('_') ? 'y' : '__') +
            completionItem.label;
        documentPosition.attachTo(completionItem);
        return completionItem;
    }
}
