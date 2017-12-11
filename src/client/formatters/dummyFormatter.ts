import * as vscode from 'vscode';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { BaseFormatter } from './baseFormatter';

export class DummyFormatter extends BaseFormatter {
    constructor(serviceContainer: IServiceContainer) {
        super('none', Product.yapf, serviceContainer);
    }

    public formatDocument(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken, range?: vscode.Range): Thenable<vscode.TextEdit[]> {
        return Promise.resolve([]);
    }
}
