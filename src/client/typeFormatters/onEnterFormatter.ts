// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    CancellationToken,
    FormattingOptions,
    OnTypeFormattingEditProvider,
    Position,
    TextDocument,
    TextEdit,
} from 'vscode';
import { LineFormatter } from '../formatters/lineFormatter';
import { TokenizerMode, TokenType } from '../language/types';
import { getDocumentTokens } from '../providers/providerUtilities';

export class OnEnterFormatter implements OnTypeFormattingEditProvider {
    private readonly formatter = new LineFormatter();

    public provideOnTypeFormattingEdits(
        document: TextDocument,
        position: Position,
        _ch: string,
        _options: FormattingOptions,
        _cancellationToken: CancellationToken
    ): TextEdit[] {
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
        const formatted = this.formatter.formatLine(document, prevLine.lineNumber);
        if (formatted === prevLine.text) {
            return [];
        }
        return [new TextEdit(prevLine.range, formatted)];
    }
}
