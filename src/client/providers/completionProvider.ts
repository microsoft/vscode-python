'use strict';

import * as vscode from 'vscode';
import { ProviderResult, SnippetString, Uri } from 'vscode';
import { PythonSettings } from '../common/configSettings';
import { captureTelemetry } from '../common/telemetry';
import { COMPLETION } from '../common/telemetry/constants';
import { JediFactory } from '../languageServices/jediProxyFactory';
import { extractSignatureAndDocumentation } from './jediHelpers';
import * as proxy from './jediProxy';

export class PythonCompletionItemProvider implements vscode.CompletionItemProvider {

    public constructor(private jediFactory: JediFactory) { }
    private static parseData(data: proxy.ICompletionResult, resource: Uri): vscode.CompletionItem[] {
        if (data && data.items.length > 0) {
            return data.items.map(item => {
                const sigAndDocs = extractSignatureAndDocumentation(item);
                const completionItem = new vscode.CompletionItem(item.text);
                completionItem.kind = item.type;
                completionItem.documentation = sigAndDocs[1].length === 0 ? item.description : sigAndDocs[1];
                completionItem.detail = sigAndDocs[0].split(/\r?\n/).join('');
                if (PythonSettings.getInstance(resource).autoComplete.addBrackets === true &&
                    (item.kind === vscode.SymbolKind.Function || item.kind === vscode.SymbolKind.Method)) {
                    completionItem.insertText = new SnippetString(item.text).appendText('(').appendTabstop().appendText(')');
                }

                // ensure the built in memebers are at the bottom
                completionItem.sortText = (completionItem.label.startsWith('__') ? 'z' : (completionItem.label.startsWith('_') ? 'y' : '__')) + completionItem.label;
                return completionItem;
            });
        }
        return [];
    }
    @captureTelemetry(COMPLETION)
    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): ProviderResult<vscode.CompletionItem[]> {
        if (position.character <= 0) {
            return Promise.resolve([]);
        }
        const filename = document.fileName;
        const lineText = document.lineAt(position.line).text;
        if (lineText.match(/^\s*\/\//)) {
            return Promise.resolve([]);
        }
        // If starts with a comment, then return
        if (lineText.trim().startsWith('#')) {
            return Promise.resolve([]);
        }
        // If starts with a """ (possible doc string), then return
        if (lineText.trim().startsWith('"""')) {
            return Promise.resolve([]);
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

        return this.jediFactory.getJediProxyHandler<proxy.ICompletionResult>(document.uri).sendCommand(cmd, token).then(data => {
            return PythonCompletionItemProvider.parseData(data, document.uri);
        });
    }
}
