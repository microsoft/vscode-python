// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as vscode from 'vscode';
import { PythonSettings } from '../common/configSettings';
import { JediFactory } from '../languageServices/jediProxyFactory';
import { ItemInfoSource, LanguageItemInfo } from './itemInfoSource';
import * as proxy from './jediProxy';
import { isPositionInsideStringOrComment } from './providerUtilities';

class DocumentPosition {
    constructor(public document: vscode.TextDocument, public position: vscode.Position) { }

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
    private itemInfoSource: ItemInfoSource;

    constructor(jediFactory: JediFactory) {
        this.jediFactory = jediFactory;
        this.itemInfoSource = new ItemInfoSource(jediFactory);
    }

    public async getVsCodeCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken)
        : Promise<vscode.CompletionItem[]> {
        const result = await this.getCompletionResult(document, position, token);
        if (result === undefined) {
            return Promise.resolve([]);
        }
        return this.toVsCodeCompletions(new DocumentPosition(document, position), result, document.uri);
    }

    public async getDocumentation(completionItem: vscode.CompletionItem, token: vscode.CancellationToken): Promise<LanguageItemInfo[] | undefined> {
        const documentPosition = DocumentPosition.fromObject(completionItem);
        if (documentPosition === undefined) {
            return;
        }

        // Supply hover source with simulated document text where item in question was 'already typed'.
        const document = documentPosition.document;
        const position = documentPosition.position;
        const itemText = completionItem.insertText ? completionItem.insertText : completionItem.label;
        const wordRange = document.getWordRangeAtPosition(position);

        const leadingRange = wordRange !== undefined
            ? new vscode.Range(new vscode.Position(0, 0), wordRange.start)
            : new vscode.Range(new vscode.Position(0, 0), position);

        const itemString = `${itemText}`;
        const sourceText = `${document.getText(leadingRange)}${itemString}`;
        const range = new vscode.Range(leadingRange.end, leadingRange.end.translate(0, itemString.length));

        return await this.itemInfoSource.getItemInfoFromText(document.uri, document.fileName, range, sourceText, token);
    }

    private async getCompletionResult(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken)
        : Promise<proxy.ICompletionResult | undefined> {
        if (position.character <= 0) {
            return undefined;
        }
        const filename = document.fileName;
        const lineText = document.lineAt(position.line).text;
        if (lineText.match(/^\s*\/\//)) {
            return undefined;
        }
        // Suppress completion inside string and comments.
        if (isPositionInsideStringOrComment(document, position)) {
            return undefined;
        }
        const type = proxy.CommandType.Completions;
        const columnIndex = position.character;

        const source = document.getText();
        const cmd: proxy.ICommand<proxy.ICommandResult> = {
            command: type,
            fileName: filename,
            columnIndex: columnIndex,
            lineIndex: position.line,
            source: source
        };

        return await this.jediFactory.getJediProxyHandler<proxy.ICompletionResult>(document.uri).sendCommand(cmd, token);
    }

    private toVsCodeCompletions(documentPosition: DocumentPosition, data: proxy.ICompletionResult, resource: vscode.Uri): vscode.CompletionItem[] {
        return data && data.items.length > 0 ? data.items.map(item => this.toVsCodeCompletion(documentPosition, item, resource)) : [];
    }

    private toVsCodeCompletion(documentPosition: DocumentPosition, item: proxy.IAutoCompleteItem, resource: vscode.Uri): vscode.CompletionItem {
        const completionItem = new vscode.CompletionItem(item.text);
        completionItem.kind = item.type;
        if (PythonSettings.getInstance(resource).autoComplete.addBrackets === true &&
            (item.kind === vscode.SymbolKind.Function || item.kind === vscode.SymbolKind.Method)) {
            completionItem.insertText = new vscode.SnippetString(item.text).appendText('(').appendTabstop().appendText(')');
        }
        // Ensure the built in members are at the bottom.
        completionItem.sortText = (completionItem.label.startsWith('__') ? 'z' : (completionItem.label.startsWith('_') ? 'y' : '__')) + completionItem.label;
        documentPosition.attachTo(completionItem);
        return completionItem;
    }
}
