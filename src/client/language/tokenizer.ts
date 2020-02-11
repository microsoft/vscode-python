// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// tslint:disable-next-line:import-name
import Char from 'typescript-char';
import { isBinary, isDecimal, isHex, isIdentifierChar, isIdentifierStartChar, isOctal } from './characters';
import { CharacterStream } from './characterStream';
import { TextRangeCollection } from './textRangeCollection';
import {
    ICharacterStream,
    ITextRangeCollection,
    IToken,
    ITokenizer,
    TextRange,
    TokenizerMode,
    TokenType
} from './types';

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
    private cs: ICharacterStream = new CharacterStream('');
    private tokens: IToken[] = [];
    private mode = TokenizerMode.Full;

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
        // f-strings, b-strings, etc
        const stringPrefixLength = this.getStringPrefixLength();
        if (stringPrefixLength >= 0) {
            // Indeed a string
            this.cs.advance(stringPrefixLength);

            const quoteType = this.getQuoteType();
            if (quoteType !== QuoteType.None) {
                this.handleString(quoteType, stringPrefixLength);
                return true;
            }
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
            default:
                if (this.isPossibleNumber()) {
                    if (this.tryNumber()) {
                        return true;
                    }
                }
                if (this.cs.currentChar === Char.Period) {
                    this.tokens.push(new Token(TokenType.Operator, this.cs.position, 1));
                    break;
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

    // tslint:disable-next-line:cyclomatic-complexity
    private isPossibleNumber(): boolean {
        if (isDecimal(this.cs.currentChar)) {
            return true;
        }

        if (this.cs.currentChar === Char.Period && isDecimal(this.cs.nextChar)) {
            return true;
        }

        const next = this.cs.currentChar === Char.Hyphen || this.cs.currentChar === Char.Plus ? 1 : 0;
        // Next character must be decimal or a dot otherwise
        // it is not a number. No whitespace is allowed.
        if (isDecimal(this.cs.lookAhead(next)) || this.cs.lookAhead(next) === Char.Period) {
            // Check what previous token is, if any
            if (this.tokens.length === 0) {
                // At the start of the file this can only be a number
                return true;
            }

            const prev = this.tokens[this.tokens.length - 1];
            if (
                prev.type === TokenType.OpenBrace ||
                prev.type === TokenType.OpenBracket ||
                prev.type === TokenType.Comma ||
                prev.type === TokenType.Colon ||
                prev.type === TokenType.Semicolon ||
                prev.type === TokenType.Operator
            ) {
                return true;
            }
        }

        if (this.cs.lookAhead(next) === Char._0) {
            const nextNext = this.cs.lookAhead(next + 1);
            if (nextNext === Char.x || nextNext === Char.X) {
                return true;
            }
            if (nextNext === Char.b || nextNext === Char.B) {
                return true;
            }
            if (nextNext === Char.o || nextNext === Char.O) {
                return true;
            }
        }

        return false;
    }

    // tslint:disable-next-line:cyclomatic-complexity
    private tryNumber(): boolean {
        const start = this.cs.position;
        let leadingSign = 0;

        if (this.cs.currentChar === Char.Hyphen || this.cs.currentChar === Char.Plus) {
            this.cs.moveNext(); // Skip leading +/-
            leadingSign = 1;
        }

        if (this.cs.currentChar === Char._0) {
            let radix = 0;
            // Try hex => hexinteger: "0" ("x" | "X") (["_"] hexdigit)+
            if ((this.cs.nextChar === Char.x || this.cs.nextChar === Char.X) && isHex(this.cs.lookAhead(2))) {
                this.cs.advance(2);
                while (isHex(this.cs.currentChar)) {
                    this.cs.moveNext();
                }
                radix = 16;
            }
            // Try binary => bininteger: "0" ("b" | "B") (["_"] bindigit)+
            if ((this.cs.nextChar === Char.b || this.cs.nextChar === Char.B) && isBinary(this.cs.lookAhead(2))) {
                this.cs.advance(2);
                while (isBinary(this.cs.currentChar)) {
                    this.cs.moveNext();
                }
                radix = 2;
            }
            // Try octal => octinteger: "0" ("o" | "O") (["_"] octdigit)+
            if ((this.cs.nextChar === Char.o || this.cs.nextChar === Char.O) && isOctal(this.cs.lookAhead(2))) {
                this.cs.advance(2);
                while (isOctal(this.cs.currentChar)) {
                    this.cs.moveNext();
                }
                radix = 8;
            }
            if (radix > 0) {
                const text = this.cs.getText().substr(start + leadingSign, this.cs.position - start - leadingSign);
                if (!isNaN(parseInt(text, radix))) {
                    this.tokens.push(new Token(TokenType.Number, start, text.length + leadingSign));
                    return true;
                }
            }
        }

        let decimal = false;
        // Try decimal int =>
        //    decinteger: nonzerodigit (["_"] digit)* | "0" (["_"] "0")*
        //    nonzerodigit: "1"..."9"
        //    digit: "0"..."9"
        if (this.cs.currentChar >= Char._1 && this.cs.currentChar <= Char._9) {
            while (isDecimal(this.cs.currentChar)) {
                this.cs.moveNext();
            }
            decimal =
                this.cs.currentChar !== Char.Period && this.cs.currentChar !== Char.e && this.cs.currentChar !== Char.E;
        }

        if (this.cs.currentChar === Char._0) {
            // "0" (["_"] "0")*
            while (this.cs.currentChar === Char._0 || this.cs.currentChar === Char.Underscore) {
                this.cs.moveNext();
            }
            decimal =
                this.cs.currentChar !== Char.Period && this.cs.currentChar !== Char.e && this.cs.currentChar !== Char.E;
        }

        if (decimal) {
            const text = this.cs.getText().substr(start + leadingSign, this.cs.position - start - leadingSign);
            if (!isNaN(parseInt(text, 10))) {
                this.tokens.push(new Token(TokenType.Number, start, text.length + leadingSign));
                return true;
            }
        }

        // Floating point. Sign was already skipped over.
        if (
            (this.cs.currentChar >= Char._0 && this.cs.currentChar <= Char._9) ||
            (this.cs.currentChar === Char.Period && this.cs.nextChar >= Char._0 && this.cs.nextChar <= Char._9)
        ) {
            if (this.skipFloatingPointCandidate(false)) {
                const text = this.cs.getText().substr(start, this.cs.position - start);
                if (!isNaN(parseFloat(text))) {
                    this.tokens.push(new Token(TokenType.Number, start, this.cs.position - start));
                    return true;
                }
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
            case Char.Ampersand:
            case Char.Bar:
            case Char.Caret:
            case Char.Equal:
            case Char.ExclamationMark:
            case Char.Percent:
            case Char.Tilde:
                length = nextChar === Char.Equal ? 2 : 1;
                break;

            case Char.Hyphen:
                length = nextChar === Char.Equal || nextChar === Char.Greater ? 2 : 1;
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
                length = nextChar === Char.Equal ? 2 : 1;
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

    // tslint:disable-next-line:cyclomatic-complexity
    private getStringPrefixLength(): number {
        if (this.cs.currentChar === Char.SingleQuote || this.cs.currentChar === Char.DoubleQuote) {
            return 0; // Simple string, no prefix
        }

        if (this.cs.nextChar === Char.SingleQuote || this.cs.nextChar === Char.DoubleQuote) {
            switch (this.cs.currentChar) {
                case Char.f:
                case Char.F:
                case Char.r:
                case Char.R:
                case Char.b:
                case Char.B:
                case Char.u:
                case Char.U:
                    return 1; // single-char prefix like u"" or r""
                default:
                    break;
            }
        }

        if (this.cs.lookAhead(2) === Char.SingleQuote || this.cs.lookAhead(2) === Char.DoubleQuote) {
            const prefix = this.cs
                .getText()
                .substr(this.cs.position, 2)
                .toLowerCase();
            switch (prefix) {
                case 'rf':
                case 'ur':
                case 'br':
                    return 2;
                default:
                    break;
            }
        }
        return -1;
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

    private handleString(quoteType: QuoteType, stringPrefixLength: number): void {
        const start = this.cs.position - stringPrefixLength;
        if (quoteType === QuoteType.Single || quoteType === QuoteType.Double) {
            this.cs.moveNext();
            this.skipToSingleEndQuote(quoteType === QuoteType.Single ? Char.SingleQuote : Char.DoubleQuote);
        } else {
            this.cs.advance(3);
            this.skipToTripleEndQuote(quoteType === QuoteType.TripleSingle ? Char.SingleQuote : Char.DoubleQuote);
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
        while (
            !this.cs.isEndOfStream() &&
            (this.cs.currentChar !== quote || this.cs.nextChar !== quote || this.cs.lookAhead(2) !== quote)
        ) {
            this.cs.moveNext();
        }
        this.cs.advance(3);
    }

    private skipFloatingPointCandidate(allowSign: boolean): boolean {
        // Determine end of the potential floating point number
        const start = this.cs.position;
        this.skipFractionalNumber(allowSign);
        if (this.cs.position > start) {
            if (this.cs.currentChar === Char.e || this.cs.currentChar === Char.E) {
                this.cs.moveNext(); // Optional exponent sign
            }
            this.skipDecimalNumber(true); // skip exponent value
        }
        return this.cs.position > start;
    }

    private skipFractionalNumber(allowSign: boolean): void {
        this.skipDecimalNumber(allowSign);
        if (this.cs.currentChar === Char.Period) {
            this.cs.moveNext(); // Optional period
        }
        this.skipDecimalNumber(false);
    }

    private skipDecimalNumber(allowSign: boolean): void {
        if (allowSign && (this.cs.currentChar === Char.Hyphen || this.cs.currentChar === Char.Plus)) {
            this.cs.moveNext(); // Optional sign
        }
        while (isDecimal(this.cs.currentChar)) {
            this.cs.moveNext(); // skip integer part
        }
    }
}
