import * as vscode from 'vscode';
import { CompletionContext, commands, Disposable } from 'vscode';
import { isTestExecution } from '../common/configSettings';
import { ImportMagicProxyFactory } from '../languageServices/importMagicProxyFactory';
import { IResultSymbols, MethodType, ICommandSymbols, ISuggestionSymbol } from './importMagicProxy';

export class ImportMagicCompletionItemProvider implements vscode.CompletionItemProvider {
    private disposables: Disposable[] = [];
    private enable: boolean = false;

    constructor(private importMagicFactory: ImportMagicProxyFactory) {
        this.disposables.push(commands.registerCommand('importMagic.findSymbols', this.toggleFindSymbols.bind(this)));
    }

    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }

    public async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position,
        token: vscode.CancellationToken, context: CompletionContext): Promise<vscode.CompletionItem[]> {
        if (!this.enable) {
            return [];
        }

        const result = await this.getCompletionResult(document, position, token);
        this.enable = false;

        if (result === undefined) {
            return [];
        }

        return result;
    }

    private toggleFindSymbols() {
        this.enable = true;
        if (!isTestExecution()) {
            commands.executeCommand('editor.action.triggerSuggest');
        }
    }

    private async getCompletionResult(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken)
        : Promise<vscode.CompletionItem[] | undefined> {
            const range = document.getWordRangeAtPosition(position);
            const text = document.getText(range);
            if (!text) {
                return undefined;
            }

        const importMagic = this.importMagicFactory.getImportMagicProxy(document.uri);
        const cmd: ICommandSymbols<IResultSymbols> = {
            method: MethodType.Symbols,
            text
        };
        const result = await importMagic.sendCommand(cmd);
        return result.items.map(item => this.toVsCodeCompletion(document, position, item));
    }

    private toVsCodeCompletion(document: vscode.TextDocument, position: vscode.Position, item: ISuggestionSymbol): vscode.CompletionItem {
        const completionItem = new vscode.CompletionItem(item.key);
        switch (item.score) {
            case 1.1:
                completionItem.kind = vscode.CompletionItemKind.Class;
                break;
            case 0.25:
                completionItem.kind = vscode.CompletionItemKind.Reference;
                break;
            case 1.2:
                completionItem.kind = vscode.CompletionItemKind.Function;
                break;
            case 1:
                completionItem.kind = vscode.CompletionItemKind.Module;
                break;
            default:
                completionItem.kind = vscode.CompletionItemKind.Text;
        }

        completionItem.command = {
            command: 'importMagic.insertImport',
            title: 'Import Magic',
            arguments: [item.module, item.variable]
        };

        if (item.variable) {
            completionItem.detail = `from ${item.module}`;
        }

        return completionItem;
    }
}
