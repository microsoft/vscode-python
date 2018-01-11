// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, FormattingOptions, OnTypeFormattingEditProvider, Position, TextDocument, TextEdit } from 'vscode';
import { TextBuilder } from '../language/textBuilder';
import { Tokenizer } from '../language/tokenizer';
import { TokenType } from '../language/types';

export class OnEnterFormatter implements OnTypeFormattingEditProvider {
    public provideOnTypeFormattingEdits(document: TextDocument, position: Position, ch: string, options: FormattingOptions, token: CancellationToken): TextEdit[] {
        if (position.line === 0) {
            return [];
        }
        const line = document.lineAt(position.line - 1);
        const formatted = this.formatLine(line.text, options);
        return [new TextEdit(line.range, formatted)];
    }

    private formatLine(text: string, options: FormattingOptions): string {
        const tokens = new Tokenizer().Tokenize(text);
        if (tokens.count === 0) {
            return text;
        }

        const builder = new TextBuilder();
        const ws = text.substr(0, tokens.getItemAt(0).start);
        if (ws.length > 0) {
            builder.append(ws);
        }

        for (let i = 0; i < tokens.count; i += 1) {
            const t = tokens.getItemAt(i);
            const prev = i > 0 ? tokens.getItemAt(i - 1) : undefined;
            const next = i < tokens.count - 1 ? tokens.getItemAt(i + 1) : undefined;

            switch (t.type) {
                case TokenType.Operator:
                    builder.softAppendSpace();
                    builder.append(text.substring(t.start, t.end));
                    builder.softAppendSpace();
                    break;

                case TokenType.Comma:
                    builder.append(',');
                    if (next && !(next.type === TokenType.CloseBrace || next.type === TokenType.CloseBracket)) {
                        builder.softAppendSpace();
                    }
                    break;

                case TokenType.OpenBrace:
                case TokenType.OpenBracket:
                case TokenType.CloseBrace:
                case TokenType.CloseBracket:
                    builder.append(text.substring(t.start, t.end));
                    break;

                case TokenType.Identifier:
                    if (!prev || (prev.type !== TokenType.OpenBrace && prev.type !== TokenType.OpenBracket)) {
                        builder.softAppendSpace();
                    }
                    builder.append(text.substring(t.start, t.end));
                    break;

                default:
                    builder.softAppendSpace();
                    builder.append(text.substring(t.start, t.end));
                    break;
            }
        }
        return builder.getText();
    }
}
