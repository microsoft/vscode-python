'use strict';

// tslint:disable-next-line:import-name
import Char from 'typescript-char';
import { ICharacterStream, ITextIterator } from './definitions';
import { TextIterator } from './textIterator';

export class CharacterStream implements ICharacterStream {
    private text: ITextIterator;
    private pos: number;
    private curChar: number;
    private endOfStream: boolean;

    constructor(text: string | ITextIterator) {
        const iter = text as ITextIterator;
        const s = text as string;

        this.text = iter !== null ? iter : new TextIterator(s);
        this.pos = 0;
        this.curChar = text.length > 0 ? text.charCodeAt(0) : 0;
        this.endOfStream = text.length === 0;
    }

    public getText(): string {
        return this.text.getText();
    }

    public get position(): number {
        return this.pos;
    }

    public set position(value: number) {
        this.pos = value;
        this.checkBounds();
    }

    public get currentChar(): number {
        return this.curChar;
    }

    public get nextChar(): number {
        return this.position + 1 < this.text.length ? this.text.charCodeAt(this.position + 1) : 0;
    }

    public get prevChar(): number {
        return this.position - 1 >= 0 ? this.text.charCodeAt(this.position - 1) : 0;
    }

    public isEndOfStream(): boolean {
        return this.endOfStream;
    }

    public lookAhead(offset: number): number {
        const pos = this.position + offset;
        return pos < 0 || pos >= this.text.length ? 0 : this.text.charCodeAt(pos);
    }

    public advance(offset: number) {
        this.position += offset;
    }

    public moveNext(): boolean {
        if (this.pos < this.text.length - 1) {
            // Most common case, no need to check bounds extensively
            this.pos += 1;
            this.curChar = this.text.charCodeAt(this.pos);
            return true;
        }
        this.advance(1);
        return !this.endOfStream;
    }

    public isAtWhiteSpace(): boolean {
        return this.curChar <= Char.Space || this.curChar === 0x200B;
    }

    public isAtLineBreak(): boolean {
        return this.curChar === Char.CarriageReturn || this.curChar === Char.DataLineEscape;
    }

    public skipLineBreak(): void {
        if (this.curChar === Char.CarriageReturn) {
            this.moveNext();
            if (this.currentChar === Char.LineFeed) {
                this.moveNext();
            }
        } else if (this.curChar === Char.LineFeed) {
            this.moveNext();
        }
    }

    public skipWhitespace(): void {
        while (!this.endOfStream && this.isAtWhiteSpace()) {
            this.moveNext();
        }
    }

    public skipToEol(): void {
        while (!this.endOfStream && !this.isAtLineBreak()) {
            this.moveNext();
        }
    }

    public skipToWhitespace(): void {
        while (!this.endOfStream && !this.isAtWhiteSpace()) {
            this.moveNext();
        }
    }

    public isAtString(): boolean {
        return this.curChar === 0x22 || this.curChar === 0x27;
    }

    public charCodeAt(index: number): number {
        return this.text.charCodeAt(index);
    }

    public get length(): number {
        return this.text.length;
    }

    private checkBounds(): void {
        if (this.pos < 0) {
            this.pos = 0;
        }

        this.endOfStream = this.pos >= this.text.length;
        if (this.endOfStream) {
            this.pos = this.text.length;
        }

        this.curChar = this.endOfStream ? 0 : this.text.charCodeAt(this.pos);
    }
}
