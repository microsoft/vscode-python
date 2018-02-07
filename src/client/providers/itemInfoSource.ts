// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { EOL } from 'os';
import * as vscode from 'vscode';
import { RestTextConverter } from '../common/markdown/restTextConverter';
import { JediFactory } from '../languageServices/jediProxyFactory';
import * as proxy from './jediProxy';
import { IHoverItem } from './jediProxy';

export class LanguageItemInfo {
    constructor(
        public tooltip: vscode.MarkdownString,
        public detail: string,
        public documentation: vscode.MarkdownString) { }
}

export class ItemInfoSource {
    private textConverter = new RestTextConverter();
    constructor(private jediFactory: JediFactory) { }

    public async getItemInfoFromText(documentUri: vscode.Uri, fileName: string, range: vscode.Range, sourceText: string, token: vscode.CancellationToken)
        : Promise<LanguageItemInfo[] | undefined> {
        const result = await this.getHoverResultFromTextRange(documentUri, fileName, range, sourceText, token);
        if (!result || !result.items.length) {
            return;
        }
        return this.getItemInfoFromHoverResult(result, '');
    }

    public async getItemInfoFromDocument(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken)
        : Promise<LanguageItemInfo[] | undefined> {
        const range = document.getWordRangeAtPosition(position);
        if (!range || range.isEmpty) {
            return;
        }
        const result = await this.getHoverResultFromDocument(document, position, token);
        if (!result || !result.items.length) {
            return;
        }
        const word = document.getText(range);
        return this.getItemInfoFromHoverResult(result, word);
    }

    private async getHoverResultFromDocument(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken)
        : Promise<proxy.IHoverResult | undefined> {
        if (position.character <= 0 || document.lineAt(position.line).text.match(/^\s*\/\//)) {
            return;
        }
        const range = document.getWordRangeAtPosition(position);
        if (!range || range.isEmpty) {
            return;
        }
        return await this.getHoverResultFromDocumentRange(document, range, token);
    }

    private async getHoverResultFromDocumentRange(document: vscode.TextDocument, range: vscode.Range, token: vscode.CancellationToken)
        : Promise<proxy.IHoverResult | undefined> {
        const cmd: proxy.ICommand<proxy.IHoverResult> = {
            command: proxy.CommandType.Hover,
            fileName: document.fileName,
            columnIndex: range.end.character,
            lineIndex: range.end.line
        };
        if (document.isDirty) {
            cmd.source = document.getText();
        }
        return await this.jediFactory.getJediProxyHandler<proxy.IHoverResult>(document.uri).sendCommand(cmd, token);
    }

    private async getHoverResultFromTextRange(documentUri: vscode.Uri, fileName: string, range: vscode.Range, sourceText: string, token: vscode.CancellationToken)
        : Promise<proxy.IHoverResult | undefined> {
        const cmd: proxy.ICommand<proxy.IHoverResult> = {
            command: proxy.CommandType.Hover,
            fileName: fileName,
            columnIndex: range.end.character,
            lineIndex: range.end.line,
            source: sourceText
        };
        return await this.jediFactory.getJediProxyHandler<proxy.IHoverResult>(documentUri).sendCommand(cmd, token);
    }

    private getItemInfoFromHoverResult(data: proxy.IHoverResult, currentWord: string): LanguageItemInfo[] {
        const infos: LanguageItemInfo[] = [];
        const capturedInfo: string[] = [];

        data.items.forEach(item => {
            const signature = this.getSignature(item, currentWord);
            let tooltip = new vscode.MarkdownString();
            if (item.docstring) {
                let lines = item.docstring.split(/\r?\n/);
                const dnd = this.getDetailAndDescription(item, lines);

                // If the docstring starts with the signature, then remove those lines from the docstring.
                if (lines.length > 0 && item.signature.indexOf(lines[0]) === 0) {
                    lines.shift();
                    const endIndex = lines.findIndex(line => item.signature.endsWith(line));
                    if (endIndex >= 0) {
                        lines = lines.filter((line, index) => index > endIndex);
                    }
                }
                if (lines.length > 0 && item.signature.startsWith(currentWord) && lines[0].startsWith(currentWord) && lines[0].endsWith(')')) {
                    lines.shift();
                }

                // Tooltip is only used in hover
                if (signature.length > 0) {
                    tooltip = tooltip.appendMarkdown(['```python', signature, '```', ''].join(EOL));
                }

                const description = this.textConverter.toMarkdown(lines.join(EOL));
                tooltip = tooltip.appendMarkdown(description);

                const documentation = this.textConverter.toMarkdown(dnd[1]); // Used only in completion list
                infos.push(new LanguageItemInfo(tooltip, dnd[0], new vscode.MarkdownString(documentation)));

                const key = signature + lines.join('');
                // Sometimes we have duplicate documentation, one with a period at the end.
                if (capturedInfo.indexOf(key) >= 0 || capturedInfo.indexOf(`${key}.`) >= 0) {
                    return;
                }
                capturedInfo.push(key);
                capturedInfo.push(`${key}.`);
                return;
            }

            if (item.description) {
                if (signature.length > 0) {
                    tooltip.appendMarkdown(['```python', signature, '```', ''].join(EOL));
                }
                const description = this.textConverter.toMarkdown(item.description);
                tooltip.appendMarkdown(description);

                const lines = item.description.split(EOL);
                const dd = this.getDetailAndDescription(item, lines);
                const documentation = this.textConverter.escapeMarkdown(dd[1]);
                infos.push(new LanguageItemInfo(tooltip, dd[0], new vscode.MarkdownString(documentation)));

                const key = signature + lines.join('');
                // Sometimes we have duplicate documentation, one with a period at the end.
                if (capturedInfo.indexOf(key) >= 0 || capturedInfo.indexOf(`${key}.`) >= 0) {
                    return;
                }

                capturedInfo.push(key);
                capturedInfo.push(`${key}.`);
                return;
            }
        });
        return infos;
    }

    private getDetailAndDescription(item: IHoverItem, lines: string[]): [string, string] {
        let detail: string;
        let description: string;

        if (item.signature && item.signature.length > 0 && lines.length > 0 && lines[0].indexOf(item.signature) >= 0) {
            detail = lines.length > 0 ? lines[0] : '';
            description = lines.filter((line, index) => index > 0).join(EOL).trim();
        } else {
            detail = item.description;
            description = lines.join(EOL).trim();
        }
        return [detail, description];
    }

    private getSignature(item: proxy.IHoverItem, currentWord: string): string {
        let { signature } = item;
        switch (item.kind) {
            case vscode.SymbolKind.Constructor:
            case vscode.SymbolKind.Function:
            case vscode.SymbolKind.Method: {
                signature = `def ${signature}`;
                break;
            }
            case vscode.SymbolKind.Class: {
                signature = `class ${signature}`;
                break;
            }
            case vscode.SymbolKind.Module: {
                if (signature.length > 0) {
                    signature = `module ${signature}`;
                }
                break;
            }
            default: {
                signature = typeof item.text === 'string' && item.text.length > 0 ? item.text : currentWord;
            }
        }
        return signature;
    }
}
