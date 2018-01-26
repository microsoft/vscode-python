// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { LineFormatter } from '../formatters/lineFormatter';

export class OnEnterFormatter implements vscode.OnTypeFormattingEditProvider {
    private readonly formatter = new LineFormatter();

    public provideOnTypeFormattingEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        ch: string,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken): vscode.TextEdit[] {
        if (position.line === 0) {
            return [];
        }
        const line = document.lineAt(position.line - 1);
        const formatted = this.formatter.formatLine(line.text);
        return [new vscode.TextEdit(line.range, formatted)];
    }
}
