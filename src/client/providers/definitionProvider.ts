'use strict';

import * as vscode from 'vscode';
import * as proxy from './jediProxy';
import * as telemetryContracts from '../common/telemetryContracts';
import { JediFactory } from '../languageServices/jediProxyFactory';

export class PythonDefinitionProvider implements vscode.DefinitionProvider {
    public constructor(private jediFactory: JediFactory) { }
    private static parseData(data: proxy.IDefinitionResult, possibleWord: string): vscode.Definition {
        if (data && Array.isArray(data.definitions) && data.definitions.length > 0) {
            const definitions = data.definitions.filter(d => d.text === possibleWord);
            const definition = definitions.length > 0 ? definitions[0] : data.definitions[data.definitions.length - 1];
            const definitionResource = vscode.Uri.file(definition.fileName);
            const range = new vscode.Range(
                definition.range.startLine, definition.range.startColumn,
                definition.range.endLine, definition.range.endColumn);
            return new vscode.Location(definitionResource, range);
        }
        return null;
    }
    public provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.Definition> {
        var filename = document.fileName;
        if (document.lineAt(position.line).text.match(/^\s*\/\//)) {
            return Promise.resolve(null);
        }
        if (position.character <= 0) {
            return Promise.resolve(null);
        }

        var range = document.getWordRangeAtPosition(position);
        var columnIndex = range.isEmpty ? position.character : range.end.character;
        var cmd: proxy.ICommand<proxy.IDefinitionResult> = {
            command: proxy.CommandType.Definitions,
            fileName: filename,
            columnIndex: columnIndex,
            lineIndex: position.line
        };
        if (document.isDirty) {
            cmd.source = document.getText();
        }
        let possibleWord = document.getText(range);
        return this.jediFactory.getJediProxyHandler<proxy.IDefinitionResult>(document.uri).sendCommand(cmd, token).then(data => {
            return PythonDefinitionProvider.parseData(data, possibleWord);
        });
    }
}
