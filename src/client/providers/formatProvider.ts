import * as vscode from 'vscode';
import { IServiceContainer } from '../ioc/types';
import { PythonSettings } from './../common/configSettings';
import { AutoPep8Formatter } from './../formatters/autoPep8Formatter';
import { BaseFormatter } from './../formatters/baseFormatter';
import { DummyFormatter } from './../formatters/dummyFormatter';
import { YapfFormatter } from './../formatters/yapfFormatter';

export class PythonFormattingEditProvider implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {
    private formatters = new Map<string, BaseFormatter>();

    public constructor(context: vscode.ExtensionContext, serviceContainer: IServiceContainer) {
        const yapfFormatter = new YapfFormatter(serviceContainer);
        const autoPep8 = new AutoPep8Formatter(serviceContainer);
        const dummy = new DummyFormatter(serviceContainer);
        this.formatters.set(yapfFormatter.Id, yapfFormatter);
        this.formatters.set(autoPep8.Id, autoPep8);
        this.formatters.set(dummy.Id, dummy);
    }

    public provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): Thenable<vscode.TextEdit[]> {
        return this.provideDocumentRangeFormattingEdits(document, undefined, options, token);
    }

    public provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range | undefined, options: vscode.FormattingOptions, token: vscode.CancellationToken): Thenable<vscode.TextEdit[]> {
        const settings = PythonSettings.getInstance(document.uri);
        const formatter = this.formatters.get(settings.formatting.provider)!;
        return formatter.formatDocument(document, options, token, range);
    }

}
