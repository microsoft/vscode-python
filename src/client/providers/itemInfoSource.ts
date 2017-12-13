// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { EOL } from 'os';
import * as vscode from 'vscode';
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

                const descriptionWithHighlightedCode = this.highlightCode(lines.join(EOL));
                const tooltip = new vscode.MarkdownString(['```python', signature, '```', descriptionWithHighlightedCode].join(EOL));
                infos.push(new LanguageItemInfo(tooltip, dnd[0], new vscode.MarkdownString(dnd[1])));

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
                const descriptionWithHighlightedCode = this.highlightCode(item.description);
                // tslint:disable-next-line:prefer-template
                const tooltip = new vscode.MarkdownString('```python' + `${EOL}${signature}${EOL}` + '```' + `${EOL}${descriptionWithHighlightedCode}`);

                const lines = item.description.split(EOL);
                const dd = this.getDetailAndDescription(item, lines);
                infos.push(new LanguageItemInfo(tooltip, dd[0], new vscode.MarkdownString(dd[1])));

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

        if (item.signature && item.signature.length > 0) {
            detail = lines.length > 0 ? lines[0] : '';
            description = lines.filter((line, index) => index > 0).join(EOL).trim();
        } else {
            detail = item.description;
            description = lines.join(EOL).trim();
        }
        return [detail, description];
    }

    private highlightCode(docstring: string): string {
        /**********
         *
         * Magic. Do not touch. [What is the best comment in source code](https://stackoverflow.com/a/185106)
         *
         * This method uses several regexs to 'translate' reStructruedText syntax (Python doc syntax) to Markdown syntax.
         *
         * Let's just keep it unchanged unless a better solution becomes possible.
         *
         **********/
        // Add 2 line break before and after docstring (used to match a blank line)
        docstring = EOL + EOL + docstring.trim() + EOL + EOL;
        // Section title -> heading level 2
        docstring = docstring.replace(/(.+\r?\n)[-=]+\r?\n/g, `## $1${EOL}`);
        // Directives: '.. directive::' -> '**directive**'
        docstring = docstring.replace(/\.\. (.*)::/g, '**$1**');
        // Pattern of 'var : description'
        const paramLinePattern = '[\\*\\w_]+ ?:[^:\r\n]+';
        // Add new line after and before param line
        docstring = docstring.replace(new RegExp(`(${EOL + paramLinePattern})`, 'g'), `$1${EOL}`);
        docstring = docstring.replace(new RegExp(`(${EOL + paramLinePattern + EOL})`, 'g'), `${EOL}$1`);
        // 'var : description' -> '`var` description'
        docstring = docstring.replace(/\r?\n([\*\w]+) ?: ?([^:\r\n]+\r?\n)/g, `${EOL}\`$1\` $2`);
        // Doctest blocks: begin with `>>>` and end with blank line
        // tslint:disable-next-line:prefer-template
        docstring = docstring.replace(/(>>>[\w\W]+?\r?\n)\r?\n/g, `${'```python' + EOL}$1${'```' + EOL + EOL}`);
        // Literal blocks: begin with `::` (literal blocks are indented or quoted; for simplicity, we end literal blocks with blank line)
        // tslint:disable-next-line:prefer-template
        docstring = docstring.replace(/(\r?\n[^\.]*)::\r?\n\r?\n([\w\W]+?\r?\n)\r?\n/g, `$1${EOL + '```' + EOL}$2${'```' + EOL + EOL}`);
        // Remove indentation in Field lists and Literal blocks
        let inCodeBlock = false;
        let codeIndentation = 0;
        const lines = docstring.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i];
            if (line.startsWith('```')) {
                inCodeBlock = !inCodeBlock;
                if (inCodeBlock) {
                    const match = lines[i + 1].match(/^ */);
                    codeIndentation = match && match.length > 0 ? match[0].length : 0;
                }
                continue;
            }
            if (!inCodeBlock) {
                lines[i] = line.replace(/^ {4,8}/, '');
                // Field lists: ':field:' -> '**field**'
                lines[i] = lines[i].replace(/:(.+?):/g, '**$1** ');
            } else {
                if (codeIndentation !== 0) {
                    lines[i] = line.substring(codeIndentation);
                }
            }
        }
        docstring = lines.join(EOL);
        // Grid Tables
        docstring = docstring.replace(/\r?\n[\+-]+\r?\n/g, EOL);
        docstring = docstring.replace(/\r?\n[\+=]+\r?\n/g, s => s.replace(/\+/g, '|').replace(/=/g, '-'));
        return docstring.trim();
    }
}
