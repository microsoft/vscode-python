import * as vscode from 'vscode';
import { Product } from '../common/types';
import { BaseFormatter } from './baseFormatter';

export class DummyFormatter extends BaseFormatter {
    constructor(outputChannel: vscode.OutputChannel) {
        super('none', Product.yapf, outputChannel);
    }

    public formatDocument(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken, range?: vscode.Range): Thenable<vscode.TextEdit[]> {
        return Promise.resolve([]);
    }
}
