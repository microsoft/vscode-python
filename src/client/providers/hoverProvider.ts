'use strict';

import { EOL } from 'os';
import * as vscode from 'vscode';
import { captureTelemetry } from '../common/telemetry';
import { HOVER_DEFINITION } from '../common/telemetry/constants';
import { JediFactory } from '../languageServices/jediProxyFactory';
import { highlightCode } from './jediHelpers';
import * as proxy from './jediProxy';

export class PythonHoverProvider implements vscode.HoverProvider {
    public constructor(private jediFactory: JediFactory) { }
    private static parseData(data: proxy.IHoverResult, currentWord: string): vscode.Hover {
        const results = [];
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
                const hoverInfo = ['```python', signature, '```', descriptionWithHighlightedCode].join(EOL);
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
                const hoverInfo = '```python' + EOL + signature + EOL + '```' + EOL + descriptionWithHighlightedCode;
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
        return new vscode.Hover(results);
    }
    @captureTelemetry(HOVER_DEFINITION)
    public async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover> {
        const filename = document.fileName;
        if (document.lineAt(position.line).text.match(/^\s*\/\//)) {
            return null;
        }
        if (position.character <= 0) {
            return null;
        }

        const range = document.getWordRangeAtPosition(position);
        if (!range || range.isEmpty) {
            return null;
        }
        const word = document.getText(range);
        const cmd: proxy.ICommand<proxy.IDefinitionResult> = {
            command: proxy.CommandType.Hover,
            fileName: filename,
            columnIndex: range.end.character,
            lineIndex: position.line
        };
        if (document.isDirty) {
            cmd.source = document.getText();
        }

        const data = await this.jediFactory.getJediProxyHandler<proxy.IHoverResult>(document.uri).sendCommand(cmd, token);
        if (!data || !data.items.length) {
            return;
        }

        return PythonHoverProvider.parseData(data, word);
    }
}
