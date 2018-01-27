// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:import-name
import Char from 'typescript-char';
import { BraceCounter } from '../language/braceCounter';
import { TextBuilder } from '../language/textBuilder';
import { Tokenizer } from '../language/tokenizer';
import { ITextRangeCollection, IToken, TokenType } from '../language/types';

export class LineFormatter {
    private builder: TextBuilder;
    private tokens: ITextRangeCollection<IToken>;
    private braceCounter: BraceCounter;
    private text: string;

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
            this.builder.append(ws); // Preserve leading indentation
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
                    if (!prev || (!this.isOpenBraceType(prev.type) && prev.type !== TokenType.Colon)) {
                        this.builder.softAppendSpace();
                    }
                    this.builder.append(this.text.substring(t.start, t.end));
                    break;

                case TokenType.Colon:
                    // x: 1 if not in slice, x[1:y] if inside the slice
                    this.builder.append(':');
                    if (!this.braceCounter.isOpened(TokenType.OpenBracket) && (next && next.type !== TokenType.Colon)) {
                        // Not inside opened [[ ... ] sequence
                        this.builder.softAppendSpace();
                    }
                    break;

                case TokenType.Comment:
                    // add space before in-line comment
                    if (prev) {
                        this.builder.softAppendSpace();
                    }
                    this.builder.append(this.text.substring(t.start, t.end));
                    break;

                default:
                    this.handleOther(t);
                    break;
            }
        }
        return this.builder.getText();
    }

    private handleOperator(index: number): void {
        const t = this.tokens.getItemAt(index);
        if (index >= 2 && t.length === 1 && this.text.charCodeAt(t.start) === Char.Equal) {
            if (this.braceCounter.isOpened(TokenType.OpenBrace)) {
                // Check if this is = in function arguments. If so, do not
                // add spaces around it.
                const prev = this.tokens.getItemAt(index - 1);
                const prevPrev = this.tokens.getItemAt(index - 2);
                if (prev.type === TokenType.Identifier &&
                    (prevPrev.type === TokenType.Comma || prevPrev.type === TokenType.OpenBrace)) {
                    this.builder.append('=');
                    return;
                }
            }
        }
        this.builder.softAppendSpace();
        this.builder.append(this.text.substring(t.start, t.end));
        this.builder.softAppendSpace();
    }

    private handleOther(t: IToken): void {
        if (this.isBraceType(t.type)) {
            this.braceCounter.countBrace(t);
        }
        this.builder.append(this.text.substring(t.start, t.end));
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
}
