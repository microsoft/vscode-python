'use strict';

import * as vscode from 'vscode';
import * as proxy from './jediProxy';
import { JediFactory } from '../languageServices/jediProxyFactory';


export class PythonReferenceProvider implements vscode.ReferenceProvider {
    public constructor(private jediFactory: JediFactory) { }
    private static parseData(data: proxy.IReferenceResult): vscode.Location[] {
        if (data && data.references.length > 0) {
            var references = data.references.filter(ref => {
                if (!ref || typeof ref.columnIndex !== 'number' || typeof ref.lineIndex !== 'number'
                    || typeof ref.fileName !== 'string' || ref.columnIndex === -1 || ref.lineIndex === -1 || ref.fileName.length === 0) {
                    return false;
                }
                return true;
            }).map(ref => {
                var definitionResource = vscode.Uri.file(ref.fileName);
                var range = new vscode.Range(ref.lineIndex, ref.columnIndex, ref.lineIndex, ref.columnIndex);

                return new vscode.Location(definitionResource, range);
            });

            return references;
        }
        return [];
    }

    public provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken): Thenable<vscode.Location[]> {
        var filename = document.fileName;
        if (document.lineAt(position.line).text.match(/^\s*\/\//)) {
            return Promise.resolve(null);
        }
        if (position.character <= 0) {
            return Promise.resolve(null);
        }

        var range = document.getWordRangeAtPosition(position);
        var columnIndex = range.isEmpty ? position.character : range.end.character;
        var cmd: proxy.ICommand<proxy.IReferenceResult> = {
            command: proxy.CommandType.Usages,
            fileName: filename,
            columnIndex: columnIndex,
            lineIndex: position.line
        };

        if (document.isDirty) {
            cmd.source = document.getText();
        }

        return this.jediFactory.getJediProxyHandler<proxy.IReferenceResult>(document.uri).sendCommand(cmd, token).then(data => {
            return PythonReferenceProvider.parseData(data);
        });
    }
}
