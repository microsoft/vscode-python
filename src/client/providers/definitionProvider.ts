'use strict';

import * as vscode from 'vscode';
import { JediFactory } from '../languageServices/jediProxyFactory';
import { captureTelemetry } from '../telemetry';
import { EventName } from '../telemetry/constants';
import * as proxy from './jediProxy';

export class PythonDefinitionProvider implements vscode.DefinitionProvider {
    public constructor(private jediFactory: JediFactory) {}
    private static parseData(data: proxy.IDefinitionResult, possibleWord: string): vscode.Definition | undefined {
        if (data && Array.isArray(data.definitions) && data.definitions.length > 0) {
            const definitions = data.definitions.filter(d => d.text === possibleWord);
            const definition = definitions.length > 0 ? definitions[0] : data.definitions[data.definitions.length - 1];
            const definitionResource = vscode.Uri.file(definition.fileName);
            const range = new vscode.Range(
                definition.range.startLine,
                definition.range.startColumn,
                definition.range.endLine,
                definition.range.endColumn
            );
            return new vscode.Location(definitionResource, range);
        }
    }
    @captureTelemetry(EventName.DEFINITION)
    public async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | undefined> {
        const filename = document.fileName;
        if (document.lineAt(position.line).text.match(/^\s*\/\//)) {
            return;
        }
        if (position.character <= 0) {
            return;
        }

        const range = document.getWordRangeAtPosition(position);
        if (!range) {
            return;
        }
        const columnIndex = range.isEmpty ? position.character : range.end.character;
        const cmd: proxy.ICommand = {
            command: proxy.CommandType.Definitions,
            fileName: filename,
            columnIndex: columnIndex,
            lineIndex: position.line
        };
        if (document.isDirty) {
            cmd.source = document.getText();
        }
        const possibleWord = document.getText(range);
        const data = await this.jediFactory
            .getJediProxyHandler<proxy.IDefinitionResult>(document.uri)
            .sendCommand(cmd, token);
        return data ? PythonDefinitionProvider.parseData(data, possibleWord) : undefined;
    }
}
