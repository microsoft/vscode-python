// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { Tokenizer } from '../language/tokenizer';
import { TokenizerMode, TokenType } from '../language/types';

export function isPositionInsideStringOrComment(document: vscode.TextDocument, position: vscode.Position): boolean {
    const tokenizeTo = position.translate(1, 0);
    const text = document.getText(new vscode.Range(new vscode.Position(0, 0), tokenizeTo));
    const t = new Tokenizer();
    const tokens = t.tokenize(text, 0, text.length, TokenizerMode.CommentsAndStrings);
    const index = tokens.getItemContaining(document.offsetAt(position));
    if (index >= 0) {
        const token = tokens.getItemAt(index);
        return token.type === TokenType.String || token.type === TokenType.Comment;
    }
    return false;
}
