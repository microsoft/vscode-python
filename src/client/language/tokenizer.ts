// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// tslint:disable-next-line:import-name
import Char from 'typescript-char';
import { isBinary, isDecimal, isHex, isIdentifierChar, isIdentifierStartChar, isOctal } from './characters';
import { CharacterStream } from './characterStream';
import { TextRangeCollection } from './textRangeCollection';
import { ICharacterStream, ITextRangeCollection, IToken, ITokenizer, TextRange, TokenizerMode, TokenType } from './types';

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
    // private keywords = [
    //     'and', 'assert', 'break', 'class', 'continue', 'def', 'del',
    //     'elif', 'else', 'except', 'exec', 'False', 'finally', 'for', 'from',
    //     'global', 'if', 'import', 'in', 'is', 'lambda', 'None', 'nonlocal',
    //     'not', 'or', 'pass', 'print', 'raise', 'return', 'True', 'try',
    //     'while', 'with', 'yield'
    // ];
    private cs: ICharacterStream = new CharacterStream('');
    private tokens: IToken[] = [];
    private floatRegex = /[-+]?(?:(?:\d*\.\d+)|(?:\d+\.?))(?:[Ee][+-]?\d+)?/;
    private mode = TokenizerMode.Full;

    constructor() {
        //this.floatRegex.compile();
    }

    public tokenize(text: string): ITextRangeCollection<IToken>;
    public tokenize(text: string, start: number, length: number, mode: TokenizerMode): ITextRangeCollection<IToken>;

    public tokenize(text: string, start?: number, length?: number, mode?: TokenizerMode): ITextRangeCollection<IToken> {
        if (start === undefined) {
            start = 0;
        } else if (start < 0 || start >= text.length) {
            throw new Error('Invalid range start');
        }

        if (length === undefined) {
            length = text.length;
        } else if (length < 0 || start + length > text.length) {
            throw new Error('Invalid range length');
        }

        this.mode = mode !== undefined ? mode : TokenizerMode.Full;

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

    // tslint:disable-next-line:cyclomatic-complexity
    private handleCharacter(): boolean {
        // f-strings
        const fString = this.cs.currentChar === Char.f && (this.cs.nextChar === Char.SingleQuote || this.cs.nextChar === Char.DoubleQuote);
        if (fString) {
            this.cs.moveNext();
        }
        const quoteType = this.getQuoteType();
        if (quoteType !== QuoteType.None) {
            this.handleString(quoteType, fString);
            return true;
        }
        if (this.cs.currentChar === Char.Hash) {
            this.handleComment();
            return true;
        }
        if (this.mode === TokenizerMode.CommentsAndStrings) {
            return false;
        }

        switch (this.cs.currentChar) {
            case Char.OpenParenthesis:
                this.tokens.push(new Token(TokenType.OpenBrace, this.cs.position, 1));
                break;
            case Char.CloseParenthesis:
                this.tokens.push(new Token(TokenType.CloseBrace, this.cs.position, 1));
                break;
            case Char.OpenBracket:
                this.tokens.push(new Token(TokenType.OpenBracket, this.cs.position, 1));
                break;
            case Char.CloseBracket:
                this.tokens.push(new Token(TokenType.CloseBracket, this.cs.position, 1));
                break;
            case Char.OpenBrace:
                this.tokens.push(new Token(TokenType.OpenCurly, this.cs.position, 1));
                break;
            case Char.CloseBrace:
                this.tokens.push(new Token(TokenType.CloseCurly, this.cs.position, 1));
                break;
            case Char.Comma:
                this.tokens.push(new Token(TokenType.Comma, this.cs.position, 1));
                break;
            case Char.Semicolon:
                this.tokens.push(new Token(TokenType.Semicolon, this.cs.position, 1));
                break;
            case Char.Colon:
                this.tokens.push(new Token(TokenType.Colon, this.cs.position, 1));
                break;
            case Char.At:
            case Char.Period:
                this.tokens.push(new Token(TokenType.Operator, this.cs.position, 1));
                break;
            default:
                if (this.isPossibleNumber()) {
                    if (this.tryNumber()) {
                        return true;
                    }
                }
                if (!this.tryIdentifier()) {
                    if (!this.tryOperator()) {
                        this.handleUnknown();
                    }
                }
                return true;
        }
        return false;
    }

    private tryIdentifier(): boolean {
        const start = this.cs.position;
        if (isIdentifierStartChar(this.cs.currentChar)) {
            this.cs.moveNext();
            while (isIdentifierChar(this.cs.currentChar)) {
                this.cs.moveNext();
            }
        }
        if (this.cs.position > start) {
            // const text = this.cs.getText().substr(start, this.cs.position - start);
            // const type = this.keywords.find((value, index) => value === text) ? TokenType.Keyword : TokenType.Identifier;
            this.tokens.push(new Token(TokenType.Identifier, start, this.cs.position - start));
            return true;
        }
        return false;
    }

    private isPossibleNumber(): boolean {
        if (this.cs.currentChar === Char.Hyphen || this.cs.currentChar === Char.Plus) {
            // Next character must be decimal or a dot otherwise
            // it is not a number. No whitespace is allowed.
            if (isDecimal(this.cs.nextChar) || this.cs.nextChar === Char.Period) {
                // Check what previous token is, if any
                if (this.tokens.length === 0) {
                    // At the start of the file this can only be a number
                    return true;
                }

                const prev = this.tokens[this.tokens.length - 1];
                if (prev.type === TokenType.OpenBrace
                    || prev.type === TokenType.OpenBracket
                    || prev.type === TokenType.Comma
                    || prev.type === TokenType.Semicolon
                    || prev.type === TokenType.Operator) {
                    return true;
                }
            }
            return false;
        }

        if (isDecimal(this.cs.currentChar)) {
            return true;
        }

        if (this.cs.currentChar === Char.Period && isDecimal(this.cs.nextChar)) {
            return true;
        }

        return false;
    }

    // tslint:disable-next-line:cyclomatic-complexity
    private tryNumber(): boolean {
        const start = this.cs.position;

        if (this.cs.currentChar === Char._0) {
            let radix = 0;
            // Try hex
            if (this.cs.nextChar === Char.x || this.cs.nextChar === Char.X) {
                this.cs.advance(2);
                while (isHex(this.cs.currentChar)) {
                    this.cs.moveNext();
                }
                radix = 16;
            }
            // Try binary
            if (this.cs.nextChar === Char.b || this.cs.nextChar === Char.B) {
                this.cs.advance(2);
                while (isBinary(this.cs.currentChar)) {
                    this.cs.moveNext();
                }
                radix = 2;
            }
            // Try octal
            if (this.cs.nextChar === Char.o || this.cs.nextChar === Char.O) {
                this.cs.advance(2);
                while (isOctal(this.cs.currentChar)) {
                    this.cs.moveNext();
                }
                radix = 8;
            }
            const text = this.cs.getText().substr(start, this.cs.position - start);
            if (radix > 0 && parseInt(text.substr(2), radix)) {
                this.tokens.push(new Token(TokenType.Number, start, text.length));
                return true;
            }
        }

        if (isDecimal(this.cs.currentChar) ||
            this.cs.currentChar === Char.Plus || this.cs.currentChar === Char.Hyphen || this.cs.currentChar === Char.Period) {
            const candidate = this.cs.getText().substr(this.cs.position);
            const re = this.floatRegex.exec(candidate);
            if (re && re.length > 0 && re[0] && candidate.startsWith(re[0])) {
                this.tokens.push(new Token(TokenType.Number, start, re[0].length));
                this.cs.position = start + re[0].length;
                return true;
            }
        }

        this.cs.position = start;
        return false;
    }

    // tslint:disable-next-line:cyclomatic-complexity
    private tryOperator(): boolean {
        let length = 0;
        const nextChar = this.cs.nextChar;
        switch (this.cs.currentChar) {
            case Char.Plus:
            case Char.Hyphen:
            case Char.Ampersand:
            case Char.Bar:
            case Char.Caret:
            case Char.Equal:
            case Char.ExclamationMark:
                length = nextChar === Char.Equal ? 2 : 1;
                break;

            case Char.Asterisk:
                if (nextChar === Char.Asterisk) {
                    length = this.cs.lookAhead(2) === Char.Equal ? 3 : 2;
                } else {
                    length = nextChar === Char.Equal ? 2 : 1;
                }
                break;

            case Char.Slash:
                if (nextChar === Char.Slash) {
                    length = this.cs.lookAhead(2) === Char.Equal ? 3 : 2;
                } else {
                    length = nextChar === Char.Equal ? 2 : 1;
                }
                break;

            case Char.Less:
                if (nextChar === Char.Greater) {
                    length = 2;
                } else if (nextChar === Char.Less) {
                    length = this.cs.lookAhead(2) === Char.Equal ? 3 : 2;
                } else {
                    length = nextChar === Char.Equal ? 2 : 1;
                }
                break;

            case Char.Greater:
                if (nextChar === Char.Greater) {
                    length = this.cs.lookAhead(2) === Char.Equal ? 3 : 2;
                } else {
                    length = nextChar === Char.Equal ? 2 : 1;
                }
                break;

            case Char.At:
                length = nextChar === Char.Equal ? 2 : 0;
                break;

            default:
                return false;
        }
        this.tokens.push(new Token(TokenType.Operator, this.cs.position, length));
        this.cs.advance(length);
        return length > 0;
    }

    private handleUnknown(): boolean {
        const start = this.cs.position;
        this.cs.skipToWhitespace();
        const length = this.cs.position - start;
        if (length > 0) {
            this.tokens.push(new Token(TokenType.Unknown, start, length));
            return true;
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

    private handleString(quoteType: QuoteType, fString: boolean): void {
        const start = fString ? this.cs.position - 1 : this.cs.position;
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
        while (!this.cs.isEndOfStream()) {
            if (this.cs.currentChar === Char.LineFeed || this.cs.currentChar === Char.CarriageReturn) {
                return; // Unterminated single-line string
            }
            if (this.cs.currentChar === Char.Backslash && this.cs.nextChar === quote) {
                this.cs.advance(2);
                continue;
            }
            if (this.cs.currentChar === quote) {
                break;
            }
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
