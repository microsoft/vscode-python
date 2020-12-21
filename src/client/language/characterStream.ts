// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import Char from 'typescript-char';
import { isLineBreak, isWhiteSpace } from './characters';
import { TextIterator } from './textIterator';
import { ICharacterStream, ITextIterator } from './types';

export class CharacterStream implements ICharacterStream {
    private text: ITextIterator;
    private _position: number;
    private _currentChar: number;
    private _isEndOfStream: boolean;

    constructor(text: string | ITextIterator) {
        this.text = typeof text === 'string' ? new TextIterator(text) : text;
        this._position = 0;
        this._currentChar = text.length > 0 ? text.charCodeAt(0) : 0;
        this._isEndOfStream = text.length === 0;
    }

    public getText(): string {
        return this.text.getText();
    }

    public get position(): number {
        return this._position;
    }

    public set position(value: number) {
        this._position = value;
        this.checkBounds();
    }

    public get currentChar(): number {
        return this._currentChar;
    }

    public get nextChar(): number {
        return this.position + 1 < this.text.length ? this.text.charCodeAt(this.position + 1) : 0;
    }

    public get prevChar(): number {
        return this.position - 1 >= 0 ? this.text.charCodeAt(this.position - 1) : 0;
    }

    public isEndOfStream(): boolean {
        return this._isEndOfStream;
    }

    public lookAhead(offset: number): number {
        const pos = this._position + offset;
        return pos < 0 || pos >= this.text.length ? 0 : this.text.charCodeAt(pos);
    }

    public advance(offset: number) {
        this.position += offset;
    }

    public moveNext(): boolean {
        if (this._position < this.text.length - 1) {
            // Most common case, no need to check bounds extensively
            this._position += 1;
            this._currentChar = this.text.charCodeAt(this._position);
            return true;
        }
        this.advance(1);
        return !this.isEndOfStream();
    }

    public isAtWhiteSpace(): boolean {
        return isWhiteSpace(this.currentChar);
    }

    public isAtLineBreak(): boolean {
        return isLineBreak(this.currentChar);
    }

    public skipLineBreak(): void {
        if (this._currentChar === Char.CarriageReturn) {
            this.moveNext();
            if (this.currentChar === Char.LineFeed) {
                this.moveNext();
            }
        } else if (this._currentChar === Char.LineFeed) {
            this.moveNext();
        }
    }

    public skipWhitespace(): void {
        while (!this.isEndOfStream() && this.isAtWhiteSpace()) {
            this.moveNext();
        }
    }

    public skipToEol(): void {
        while (!this.isEndOfStream() && !this.isAtLineBreak()) {
            this.moveNext();
        }
    }

    public skipToWhitespace(): void {
        while (!this.isEndOfStream() && !this.isAtWhiteSpace()) {
            this.moveNext();
        }
    }

    public isAtString(): boolean {
        return this.currentChar === Char.SingleQuote || this.currentChar === Char.DoubleQuote;
    }

    public charCodeAt(index: number): number {
        return this.text.charCodeAt(index);
    }

    public get length(): number {
        return this.text.length;
    }

    private checkBounds(): void {
        if (this._position < 0) {
            this._position = 0;
        }

        this._isEndOfStream = this._position >= this.text.length;
        if (this._isEndOfStream) {
            this._position = this.text.length;
        }

        this._currentChar = this._isEndOfStream ? 0 : this.text.charCodeAt(this._position);
    }
}
