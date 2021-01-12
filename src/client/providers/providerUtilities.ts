// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Position, Range, TextDocument } from 'vscode';
import { Tokenizer } from '../language/tokenizer';
import { ITextRangeCollection, IToken, TokenizerMode, TokenType } from '../language/types';

export function getDocumentTokens(
    document: TextDocument,
    tokenizeTo: Position,
    mode: TokenizerMode,
): ITextRangeCollection<IToken> {
    const text = document.getText(new Range(new Position(0, 0), tokenizeTo));
    return new Tokenizer().tokenize(text, 0, text.length, mode);
}

export function isPositionInsideStringOrComment(document: TextDocument, position: Position): boolean {
    const tokenizeTo = position.translate(1, 0);
    const tokens = getDocumentTokens(document, tokenizeTo, TokenizerMode.CommentsAndStrings);
    const offset = document.offsetAt(position);
    const index = tokens.getItemContaining(offset - 1);
    if (index >= 0) {
        const token = tokens.getItemAt(index);
        return token.type === TokenType.String || token.type === TokenType.Comment;
    }
    if (offset > 0 && index >= 0) {
        // In case position is at the every end of the comment or unterminated string
        const token = tokens.getItemAt(index);
        return token.end === offset && token.type === TokenType.Comment;
    }
    return false;
}
