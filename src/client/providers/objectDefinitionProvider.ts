'use strict';

import * as vscode from 'vscode';
import { JediFactory } from '../languageServices/jediProxyFactory';
import { captureTelemetry } from '../telemetry';
import { EventName } from '../telemetry/constants';
import * as defProvider from './definitionProvider';

export class PythonObjectDefinitionProvider {
    private readonly _defProvider: defProvider.PythonDefinitionProvider;
    public constructor(jediFactory: JediFactory) {
        this._defProvider = new defProvider.PythonDefinitionProvider(jediFactory);
    }

    @captureTelemetry(EventName.GO_TO_OBJECT_DEFINITION)
    public async goToObjectDefinition() {
        const pathDef = await this.getObjectDefinition();
        if (typeof pathDef !== 'string' || pathDef.length === 0) {
            return;
        }

        const parts = pathDef.split('.');
        let source = '';
        let startColumn = 0;
        if (parts.length === 1) {
            source = `import ${parts[0]}`;
            startColumn = 'import '.length;
        } else {
            const mod = parts.shift();
            source = `from ${mod} import ${parts.join('.')}`;
            startColumn = `from ${mod} import `.length;
        }
        const range = new vscode.Range(0, startColumn, 0, source.length - 1);
        // tslint:disable-next-line:no-any
        const doc = <vscode.TextDocument>(<any>{
            fileName: 'test.py',
            lineAt: (_line: number) => {
                return { text: source };
            },
            getWordRangeAtPosition: (_position: vscode.Position) => range,
            isDirty: true,
            getText: () => source,
        });

        const tokenSource = new vscode.CancellationTokenSource();
        const defs = await this._defProvider.provideDefinition(doc, range.start, tokenSource.token);

        if (defs === null) {
            await vscode.window.showInformationMessage(`Definition not found for '${pathDef}'`);
            return;
        }

        let uri: vscode.Uri | undefined;
        let lineNumber: number;
        if (Array.isArray(defs) && defs.length > 0) {
            uri = defs[0].uri;
            lineNumber = defs[0].range.start.line;
        }
        if (defs && !Array.isArray(defs) && defs.uri) {
            uri = defs.uri;
            lineNumber = defs.range.start.line;
        }

        if (uri) {
            const openedDoc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(openedDoc);
            await vscode.commands.executeCommand('revealLine', { lineNumber: lineNumber!, at: 'top' });
        } else {
            await vscode.window.showInformationMessage(`Definition not found for '${pathDef}'`);
        }
    }

    private intputValidation(value: string): string | undefined | null {
        if (typeof value !== 'string') {
            return '';
        }
        value = value.trim();
        if (value.length === 0) {
            return '';
        }

        return null;
    }
    private async getObjectDefinition(): Promise<string | undefined> {
        return vscode.window.showInputBox({ prompt: 'Enter Object Path', validateInput: this.intputValidation });
    }
}
