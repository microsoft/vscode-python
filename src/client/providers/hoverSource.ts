// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { EOL } from 'os';
import * as vscode from 'vscode';
import { JediFactory } from '../languageServices/jediProxyFactory';
import { highlightCode } from './jediHelpers';
import * as proxy from './jediProxy';

export class HoverSource {
    constructor(private jediFactory: JediFactory) { }

    public async getVsCodeHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken)
        : Promise<vscode.Hover | undefined> {
        const strings = await this.getHoverStringsFromDocument(document, position, token);
        if (!strings) {
            return;
        }
        return new vscode.Hover(strings);
    }

    // tslint:disable-next-line:no-any
    public async getHoverStringsFromText(documentUri: vscode.Uri, fileName: string, range: vscode.Range, sourceText: string, token: vscode.CancellationToken): Promise<any[]> {
        const result = await this.getHoverResultFromTextRange(documentUri, fileName, range, sourceText, token);
        if (!result || !result.items.length) {
            return [];
        }
        return this.getHoverStringsFromResult(result, '', false);
    }

    // tslint:disable-next-line:no-any
    private async getHoverStringsFromDocument(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<any[]> {
        const range = document.getWordRangeAtPosition(position);
        if (!range || range.isEmpty) {
            return [];
        }
        const result = await this.getHoverResultFromDocument(document, position, token);
        if (!result || !result.items.length) {
            return [];
        }
        const word = document.getText(range);
        return this.getHoverStringsFromResult(result, word, true);
    }

    private async getHoverResultFromDocument(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken)
        : Promise<proxy.IHoverResult | undefined> {
        if (document.lineAt(position.line).text.match(/^\s*\/\//)) {
            return;
        }
        if (position.character <= 0) {
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

    // tslint:disable-next-line:no-any
    private getHoverStringsFromResult(data: proxy.IHoverResult, currentWord: string, markedStringInfo: boolean): any[] {
        const results: string[] = [];
        const capturedInfo: string[] = [];
        data.items.forEach(item => {
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
                default: {
                    signature = typeof item.text === 'string' && item.text.length > 0 ? item.text : currentWord;
                }
            }
            if (item.docstring) {
                let lines = item.docstring.split(/\r?\n/);
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
                const descriptionWithHighlightedCode = highlightCode(lines.join(EOL));
                const hoverInfo = markedStringInfo ? ['```python', signature, '```', descriptionWithHighlightedCode].join(EOL) : descriptionWithHighlightedCode;
                const key = signature + lines.join('');
                // Sometimes we have duplicate documentation, one with a period at the end.
                if (capturedInfo.indexOf(key) >= 0 || capturedInfo.indexOf(`${key}.`) >= 0) {
                    return;
                }
                capturedInfo.push(key);
                capturedInfo.push(`${key}.`);
                results.push(hoverInfo);
                return;
            }

            if (item.description) {
                const descriptionWithHighlightedCode = highlightCode(item.description);
                // tslint:disable-next-line:prefer-template
                const hoverInfo = '```python' + `${EOL}${signature}${EOL}` + '```' + `${EOL}${descriptionWithHighlightedCode}`;
                const lines = item.description.split(EOL);
                const key = signature + lines.join('');
                // Sometimes we have duplicate documentation, one with a period at the end.
                if (capturedInfo.indexOf(key) >= 0 || capturedInfo.indexOf(`${key}.`) >= 0) {
                    return;
                }
                capturedInfo.push(key);
                capturedInfo.push(`${key}.`);
                results.push(hoverInfo);
            }
        });
        return results;
    }
}
