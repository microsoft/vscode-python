// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:import-name
import Char from 'typescript-char';
import { BraceCounter } from '../language/braceCounter';
import { TextBuilder } from '../language/textBuilder';
import { TextRangeCollection } from '../language/textRangeCollection';
import { Tokenizer } from '../language/tokenizer';
import { ITextRangeCollection, IToken, TokenType } from '../language/types';

export class LineFormatter {
    private builder = new TextBuilder();
    private tokens: ITextRangeCollection<IToken> = new TextRangeCollection<IToken>([]);
    private braceCounter = new BraceCounter();
    private text = '';

    // tslint:disable-next-line:cyclomatic-complexity
    public formatLine(text: string): string {
        this.tokens = new Tokenizer().tokenize(text);
        this.text = text;
        this.builder = new TextBuilder();
        this.braceCounter = new BraceCounter();

        if (this.tokens.count === 0) {
            return this.text;
        }

        const ws = this.text.substr(0, this.tokens.getItemAt(0).start);
        if (ws.length > 0) {
            this.builder.append(ws); // Preserve leading indentation.
        }

        for (let i = 0; i < this.tokens.count; i += 1) {
            const t = this.tokens.getItemAt(i);
            const prev = i > 0 ? this.tokens.getItemAt(i - 1) : undefined;
            const next = i < this.tokens.count - 1 ? this.tokens.getItemAt(i + 1) : undefined;

            switch (t.type) {
                case TokenType.Operator:
                    this.handleOperator(i);
                    break;

                case TokenType.Comma:
                    this.builder.append(',');
                    if (next && !this.isCloseBraceType(next.type)) {
                        this.builder.softAppendSpace();
                    }
                    break;

                case TokenType.Identifier:
                    if (prev && !this.isOpenBraceType(prev.type) && prev.type !== TokenType.Colon && prev.type !== TokenType.Operator) {
                        this.builder.softAppendSpace();
                    }
                    this.builder.append(this.text.substring(t.start, t.end));
                    break;

                case TokenType.Colon:
                    // x: 1 if not in slice, x[1:y] if inside the slice.
                    this.builder.append(':');
                    if (!this.braceCounter.isOpened(TokenType.OpenBracket) && (next && next.type !== TokenType.Colon)) {
                        // Not inside opened [[ ... ] sequence.
                        this.builder.softAppendSpace();
                    }
                    break;

                case TokenType.Comment:
                    // Add space before in-line comment.
                    if (prev) {
                        this.builder.softAppendSpace();
                    }
                    this.builder.append(this.text.substring(t.start, t.end));
                    break;

                case TokenType.Semicolon:
                    this.builder.append(';');
                    break;

                default:
                    this.handleOther(t, i);
                    break;
            }
        }
        return this.builder.getText();
    }

    private handleOperator(index: number): void {
        const t = this.tokens.getItemAt(index);
        if (t.length === 1) {
            const opCode = this.text.charCodeAt(t.start);
            switch (opCode) {
                case Char.Equal:
                    if (this.handleEqual(t, index)) {
                        return;
                    }
                    break;
                case Char.Period:
                    this.builder.append('.');
                    return;
                case Char.At:
                    this.builder.append('@');
                    return;
                default:
                    break;
            }
        }
        this.builder.softAppendSpace();
        this.builder.append(this.text.substring(t.start, t.end));
        this.builder.softAppendSpace();
    }

    private handleEqual(t: IToken, index: number): boolean {
        if (this.isMultipleStatements(index) && !this.braceCounter.isOpened(TokenType.OpenBrace)) {
            return false; // x = 1; x, y = y, x
        }
        // Check if this is = in function arguments. If so, do not add spaces around it.
        if (this.isEqualsInsideArguments(index)) {
            this.builder.append('=');
            return true;
        }
        return false;
    }

    private handleOther(t: IToken, index: number): void {
        if (this.isBraceType(t.type)) {
            this.braceCounter.countBrace(t);
            this.builder.append(this.text.substring(t.start, t.end));
            return;
        }

        if (this.isEqualsInsideArguments(index - 1)) {
            // Don't add space around = inside function arguments.
            this.builder.append(this.text.substring(t.start, t.end));
            return;
        }

        if (index > 0) {
            const prev = this.tokens.getItemAt(index - 1);
            if (this.isOpenBraceType(prev.type) || prev.type === TokenType.Colon) {
                // Don't insert space after (, [ or { .
                this.builder.append(this.text.substring(t.start, t.end));
                return;
            }
        }

        // In general, keep tokens separated.
        this.builder.softAppendSpace();
        this.builder.append(this.text.substring(t.start, t.end));
    }

    private isEqualsInsideArguments(index: number): boolean {
        if (index < 1) {
            return false;
        }
        const prev = this.tokens.getItemAt(index - 1);
        if (prev.type === TokenType.Identifier) {
            if (index >= 2) {
                // (x=1 or ,x=1
                const prevPrev = this.tokens.getItemAt(index - 2);
                return prevPrev.type === TokenType.Comma || prevPrev.type === TokenType.OpenBrace;
            } else if (index < this.tokens.count - 2) {
                const next = this.tokens.getItemAt(index + 1);
                const nextNext = this.tokens.getItemAt(index + 2);
                // x=1, or x=1)
                if (this.isValueType(next.type)) {
                    return nextNext.type === TokenType.Comma || nextNext.type === TokenType.CloseBrace;
                }
            }
        }
        return false;
    }

    private isOpenBraceType(type: TokenType): boolean {
        return type === TokenType.OpenBrace || type === TokenType.OpenBracket || type === TokenType.OpenCurly;
    }
    private isCloseBraceType(type: TokenType): boolean {
        return type === TokenType.CloseBrace || type === TokenType.CloseBracket || type === TokenType.CloseCurly;
    }
    private isBraceType(type: TokenType): boolean {
        return this.isOpenBraceType(type) || this.isCloseBraceType(type);
    }
    private isValueType(type: TokenType): boolean {
        return type === TokenType.Identifier || type === TokenType.Unknown ||
            type === TokenType.Number || type === TokenType.String;
    }
    private isMultipleStatements(index: number): boolean {
        for (let i = index; i >= 0; i -= 1) {
            if (this.tokens.getItemAt(i).type === TokenType.Semicolon) {
                return true;
            }
        }
        return false;
    }
}
