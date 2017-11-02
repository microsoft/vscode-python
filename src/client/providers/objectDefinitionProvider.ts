'use strict';

import * as vscode from 'vscode';
import { captureTelemetry } from '../common/telemetry';
import { GO_TO_OBJECT_DEFINITION } from '../common/telemetry/constants';
import { JediFactory } from '../languageServices/jediProxyFactory';
import * as defProvider from './definitionProvider';

export function activateGoToObjectDefinitionProvider(jediFactory: JediFactory): vscode.Disposable[] {
    const def = new PythonObjectDefinitionProvider(jediFactory);
    const commandRegistration = vscode.commands.registerCommand("python.goToPythonObject", () => def.goToObjectDefinition());
    return [def, commandRegistration] as vscode.Disposable[];
}

export class PythonObjectDefinitionProvider {
    private readonly _defProvider: defProvider.PythonDefinitionProvider;
    public constructor(jediFactory: JediFactory) {
        this._defProvider = new defProvider.PythonDefinitionProvider(jediFactory);
    }

    @captureTelemetry(GO_TO_OBJECT_DEFINITION)
    public async goToObjectDefinition() {
        let pathDef = await this.getObjectDefinition();
        if (typeof pathDef !== 'string' || pathDef.length === 0) {
            return;
        }

        let parts = pathDef.split('.');
        let source = '';
        let startColumn = 0;
        if (parts.length === 1) {
            source = `import ${parts[0]}`;
            startColumn = 'import '.length;
        }
        else {
            let mod = parts.shift();
            source = `from ${mod} import ${parts.join('.')}`;
            startColumn = `from ${mod} import `.length;
        }
        const range = new vscode.Range(0, startColumn, 0, source.length - 1);
        let doc = <vscode.TextDocument><any>{
            fileName: 'test.py',
            lineAt: (line: number) => {
                return { text: source };
            },
            getWordRangeAtPosition: (position: vscode.Position) => range,
            isDirty: true,
            getText: () => source
        };

        let tokenSource = new vscode.CancellationTokenSource();
        let defs = await this._defProvider.provideDefinition(doc, range.start, tokenSource.token);

        if (defs === null) {
            await vscode.window.showInformationMessage(`Definition not found for '${pathDef}'`);
            return;
        }

        let uri: vscode.Uri;
        let lineNumber: number;
        if (Array.isArray(defs) && defs.length > 0) {
            uri = defs[0].uri;
            lineNumber = defs[0].range.start.line;
        }
        if (!Array.isArray(defs) && defs.uri) {
            uri = defs.uri;
            lineNumber = defs.range.start.line;
        }

        if (uri) {
            let doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc);
            await vscode.commands.executeCommand('revealLine', { lineNumber: lineNumber, 'at': 'top' });
        }
        else {
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
    private async getObjectDefinition(): Promise<string> {
        let value = await vscode.window.showInputBox({ prompt: "Enter Object Path", validateInput: this.intputValidation });
        return value;
    }
}
