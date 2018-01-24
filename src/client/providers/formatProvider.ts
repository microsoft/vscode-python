import { setTimeout } from 'timers';
import * as vscode from 'vscode';
import { Disposable } from 'vscode';
import { IServiceContainer } from '../ioc/types';
import { PythonSettings } from './../common/configSettings';
import { AutoPep8Formatter } from './../formatters/autoPep8Formatter';
import { BaseFormatter } from './../formatters/baseFormatter';
import { DummyFormatter } from './../formatters/dummyFormatter';
import { YapfFormatter } from './../formatters/yapfFormatter';

export class PythonFormattingEditProvider implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider, Disposable {
    private formatters = new Map<string, BaseFormatter>();
    private disposables: Disposable[] = [];

    // Workaround for https://github.com/Microsoft/vscode/issues/41194
    private contentBeforeFormatting: string | undefined;
    private wasFormatted = false;
    private saving = false;

    public constructor(context: vscode.ExtensionContext, serviceContainer: IServiceContainer) {
        const yapfFormatter = new YapfFormatter(serviceContainer);
        const autoPep8 = new AutoPep8Formatter(serviceContainer);
        const dummy = new DummyFormatter(serviceContainer);
        this.formatters.set(yapfFormatter.Id, yapfFormatter);
        this.formatters.set(autoPep8.Id, autoPep8);
        this.formatters.set(dummy.Id, dummy);
        this.disposables.push(vscode.workspace.onDidSaveTextDocument(document => this.onSaveDocument(document)));
    }

    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }

    public provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): Promise<vscode.TextEdit[]> {
        return this.provideDocumentRangeFormattingEdits(document, undefined, options, token);
    }

    public async provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range | undefined, options: vscode.FormattingOptions, token: vscode.CancellationToken): Promise<vscode.TextEdit[]> {
        // Workaround for https://github.com/Microsoft/vscode/issues/41194
        // VSC rejects 'format on save' promise in 750 ms. Python formatting may take quite a bit longer.
        // Workaround is to resolve promise to nothing here, then execute format document and force new save.
        // However, we need to know if this is 'format document' or formatting on save.

        if (this.saving) {
            // We are saving after formatting (see onSaveDocument below)
            // so we do not want to format again.
            return [];
        }

        // Remember content before formatting so we can detect if
        // formatting edits have been really applied
        const editorConfig = vscode.workspace.getConfiguration('editor', document.uri);
        if (editorConfig.get('formatOnSave') === true) {
            this.contentBeforeFormatting = document.getText();
        }

        const settings = PythonSettings.getInstance(document.uri);
        const formatter = this.formatters.get(settings.formatting.provider)!;

        const edits = await formatter.formatDocument(document, options, token, range);
        this.wasFormatted = edits.length > 0;
        return edits;
    }

    private async onSaveDocument(document: vscode.TextDocument): Promise<void> {
        // Promise was rejected = formatting took too long.
        // Don't format inside the event handler, do it on timeout
        setTimeout(() => {
            if (this.wasFormatted && this.contentBeforeFormatting && this.contentBeforeFormatting === document.getText()) {
                // Document was not actually formatted
                vscode.commands.executeCommand('editor.action.formatDocument').then(async () => {
                    this.saving = true;
                    await document.save();
                    this.saving = false;
                });
            }
            this.contentBeforeFormatting = undefined;
        }, 50);
    }
}
