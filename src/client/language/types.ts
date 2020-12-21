// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

export interface ITextRange {
    readonly start: number;
    readonly end: number;
    readonly length: number;
    contains(position: number): boolean;
}

export class TextRange implements ITextRange {
    public static readonly empty = TextRange.fromBounds(0, 0);

    public readonly start: number;
    public readonly length: number;

    constructor(start: number, length: number) {
        if (start < 0) {
            throw new Error('start must be non-negative');
        }
        if (length < 0) {
            throw new Error('length must be non-negative');
        }
        this.start = start;
        this.length = length;
    }

    public static fromBounds(start: number, end: number) {
        return new TextRange(start, end - start);
    }

    public get end(): number {
        return this.start + this.length;
    }

    public contains(position: number): boolean {
        return position >= this.start && position < this.end;
    }
}

export interface ITextRangeCollection<T> extends ITextRange {
    count: number;
    getItemAt(index: number): T;
    getItemAtPosition(position: number): number;
    getItemContaining(position: number): number;
}

export interface ITextIterator {
    readonly length: number;
    charCodeAt(index: number): number;
    getText(): string;
}

export interface ICharacterStream extends ITextIterator {
    position: number;
    readonly currentChar: number;
    readonly nextChar: number;
    readonly prevChar: number;
    getText(): string;
    isEndOfStream(): boolean;
    lookAhead(offset: number): number;
    advance(offset: number): void;
    moveNext(): boolean;
    isAtWhiteSpace(): boolean;
    isAtLineBreak(): boolean;
    isAtString(): boolean;
    skipLineBreak(): void;
    skipWhitespace(): void;
    skipToEol(): void;
    skipToWhitespace(): void;
}

export enum TokenType {
    Unknown,
    String,
    Comment,
    Keyword,
    Number,
    Identifier,
    Operator,
    Colon,
    Semicolon,
    Comma,
    OpenBrace,
    CloseBrace,
    OpenBracket,
    CloseBracket,
    OpenCurly,
    CloseCurly,
}

export interface IToken extends ITextRange {
    readonly type: TokenType;
}

export enum TokenizerMode {
    CommentsAndStrings,
    Full,
}

export interface ITokenizer {
    tokenize(text: string): ITextRangeCollection<IToken>;
    tokenize(text: string, start: number, length: number, mode: TokenizerMode): ITextRangeCollection<IToken>;
}
