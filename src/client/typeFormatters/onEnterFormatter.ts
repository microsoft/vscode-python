// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { LineFormatter } from '../formatters/lineFormatter';
import { TokenizerMode, TokenType } from '../language/types';
import { getDocumentTokens } from '../providers/providerUtilities';

export class OnEnterFormatter implements vscode.OnTypeFormattingEditProvider {
    private readonly formatter = new LineFormatter();

    public provideOnTypeFormattingEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        ch: string,
        options: vscode.FormattingOptions,
        cancellationToken: vscode.CancellationToken): vscode.TextEdit[] {
        if (position.line === 0) {
            return [];
        }

        // Check case when the entire line belongs to a comment or string
        const prevLine = document.lineAt(position.line - 1);
        const tokens = getDocumentTokens(document, position, TokenizerMode.CommentsAndStrings);
        const lineStartTokenIndex = tokens.getItemContaining(document.offsetAt(prevLine.range.start));
        const lineEndTokenIndex = tokens.getItemContaining(document.offsetAt(prevLine.range.end));
        if (lineStartTokenIndex >= 0 && lineStartTokenIndex === lineEndTokenIndex) {
            const token = tokens.getItemAt(lineStartTokenIndex);
            if (token.type === TokenType.Semicolon || token.type === TokenType.String) {
                return [];
            }
        }
        const formatted = this.formatter.formatLine(prevLine.text);
        if (formatted === prevLine.text) {
            return [];
        }
        return [new vscode.TextEdit(prevLine.range, formatted)];
    }
}
