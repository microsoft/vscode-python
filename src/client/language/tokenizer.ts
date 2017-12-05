// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// tslint:disable-next-line:import-name
import Char from 'typescript-char';
import { CharacterStream } from './characterStream';
import { TextRangeCollection } from './textRangeCollection';
import { ICharacterStream, ITextRangeCollection, IToken, ITokenizer, TextRange, TokenType } from './types';

enum QuoteType {
    None,
    Single,
    Double,
    TripleSingle,
    TripleDouble
}

class Token extends TextRange implements IToken {
    public readonly type: TokenType;

    constructor(type: TokenType, start: number, length: number) {
        super(start, length);
        this.type = type;
    }
}

export class Tokenizer implements ITokenizer {
    private cs: ICharacterStream;
    private tokens: IToken[] = [];

    public Tokenize(text: string): ITextRangeCollection<IToken>;
    public Tokenize(text: string, start: number, length: number): ITextRangeCollection<IToken>;

    public Tokenize(text: string, start?: number, length?: number): ITextRangeCollection<IToken> {
        if (start === undefined) {
            start = 0;
        } else if (start < 0 || start >= text.length) {
            throw new Error('Invalid range start');
        }

        if (length === undefined) {
            length = text.length;
        } else if (length < 0 || start + length >= text.length) {
            throw new Error('Invalid range length');
        }

        this.cs = new CharacterStream(text);
        this.cs.position = start;

        const end = start + length;
        while (!this.cs.isEndOfStream()) {
            this.AddNextToken();
            if (this.cs.position >= end) {
                break;
            }
        }
        return new TextRangeCollection(this.tokens);
    }

    private AddNextToken(): void {
        this.cs.skipWhitespace();
        if (this.cs.isEndOfStream()) {
            return;
        }

        if (!this.handleCharacter()) {
            this.cs.moveNext();
        }
    }

    private handleCharacter(): boolean {
        const quoteType = this.getQuoteType();
        if (quoteType !== QuoteType.None) {
            this.handleString(quoteType);
            return true;
        }
        switch (this.cs.currentChar) {
            case Char.Hash:
                this.handleComment();
                break;
            default:
                break;
        }
        return false;
    }

    private handleComment(): void {
        const start = this.cs.position;
        this.cs.skipToEol();
        this.tokens.push(new Token(TokenType.Comment, start, this.cs.position - start));
    }

    private getQuoteType(): QuoteType {
        if (this.cs.currentChar === Char.SingleQuote) {
            return this.cs.nextChar === Char.SingleQuote && this.cs.lookAhead(2) === Char.SingleQuote
                ? QuoteType.TripleSingle
                : QuoteType.Single;
        }
        if (this.cs.currentChar === Char.DoubleQuote) {
            return this.cs.nextChar === Char.DoubleQuote && this.cs.lookAhead(2) === Char.DoubleQuote
                ? QuoteType.TripleDouble
                : QuoteType.Double;
        }
        return QuoteType.None;
    }

    private handleString(quoteType: QuoteType): void {
        const start = this.cs.position;
        if (quoteType === QuoteType.Single || quoteType === QuoteType.Double) {
            this.cs.moveNext();
            this.skipToSingleEndQuote(quoteType === QuoteType.Single
                ? Char.SingleQuote
                : Char.DoubleQuote);
        } else {
            this.cs.advance(3);
            this.skipToTripleEndQuote(quoteType === QuoteType.TripleSingle
                ? Char.SingleQuote
                : Char.DoubleQuote);
        }
        this.tokens.push(new Token(TokenType.String, start, this.cs.position - start));
    }

    private skipToSingleEndQuote(quote: number): void {
        while (!this.cs.isEndOfStream() && this.cs.currentChar !== quote) {
            this.cs.moveNext();
        }
        this.cs.moveNext();
    }

    private skipToTripleEndQuote(quote: number): void {
        while (!this.cs.isEndOfStream() && (this.cs.currentChar !== quote || this.cs.nextChar !== quote || this.cs.lookAhead(2) !== quote)) {
            this.cs.moveNext();
        }
        this.cs.advance(3);
    }
}
