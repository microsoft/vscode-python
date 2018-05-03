// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:import-name
import Char from 'typescript-char';
import { TextDocument } from 'vscode';
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
    private document?: TextDocument;
    private lineNumber = 0;

    // tslint:disable-next-line:cyclomatic-complexity
    public formatLine(document: TextDocument, lineNumber: number): string {
        this.document = document;
        this.lineNumber = lineNumber;
        this.text = document.lineAt(lineNumber).text;
        this.tokens = new Tokenizer().tokenize(this.text);
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
                    if (next && !this.isCloseBraceType(next.type) && next.type !== TokenType.Colon) {
                        this.builder.softAppendSpace();
                    }
                    break;

                case TokenType.Identifier:
                    if (prev && !this.isOpenBraceType(prev.type) && prev.type !== TokenType.Colon && prev.type !== TokenType.Operator) {
                        this.builder.softAppendSpace();
                    }
                    const id = this.text.substring(t.start, t.end);
                    this.builder.append(id);
                    if (this.keywordWithSpaceAfter(id) && next && this.isOpenBraceType(next.type)) {
                        // for x in ()
                        this.builder.softAppendSpace();
                    }
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

    // tslint:disable-next-line:cyclomatic-complexity
    private handleOperator(index: number): void {
        const t = this.tokens.getItemAt(index);
        const prev = index > 0 ? this.tokens.getItemAt(index - 1) : undefined;
        if (t.length === 1) {
            const opCode = this.text.charCodeAt(t.start);
            switch (opCode) {
                case Char.Equal:
                    if (this.handleEqual(t, index)) {
                        return;
                    }
                    break;
                case Char.Period:
                case Char.At:
                case Char.ExclamationMark:
                    this.builder.append(this.text[t.start]);
                    return;
                case Char.Asterisk:
                    if (prev && this.isKeyword(prev, 'lambda')) {
                        this.builder.softAppendSpace();
                        this.builder.append('*');
                        return;
                    }
                    break;
                default:
                    break;
            }
        } else if (t.length === 2) {
            if (this.text.charCodeAt(t.start) === Char.Asterisk && this.text.charCodeAt(t.start + 1) === Char.Asterisk) {
                if (!prev || (prev.type !== TokenType.Identifier && prev.type !== TokenType.Number)) {
                    this.builder.append('**');
                    return;
                }
                if (prev && this.isKeyword(prev, 'lambda')) {
                    this.builder.softAppendSpace();
                    this.builder.append('**');
                    return;
                }
            }
        }

        // Do not append space if operator is preceded by '(' or ',' as in foo(**kwarg)
        if (prev && (this.isOpenBraceType(prev.type) || prev.type === TokenType.Comma)) {
            this.builder.append(this.text.substring(t.start, t.end));
            return;
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

        const prev = index > 0 ? this.tokens.getItemAt(index - 1) : undefined;
        if (prev && prev.length === 1 && this.text.charCodeAt(prev.start) === Char.Equal && this.isEqualsInsideArguments(index - 1)) {
            // Don't add space around = inside function arguments.
            this.builder.append(this.text.substring(t.start, t.end));
            return;
        }

        if (prev && (this.isOpenBraceType(prev.type) || prev.type === TokenType.Colon)) {
            // Don't insert space after (, [ or { .
            this.builder.append(this.text.substring(t.start, t.end));
            return;
        }

        if (t.type === TokenType.Unknown) {
            this.handleUnknown(t);
        } else {
            // In general, keep tokens separated.
            this.builder.softAppendSpace();
            this.builder.append(this.text.substring(t.start, t.end));
        }
    }

    private handleUnknown(t: IToken): void {
        const prevChar = t.start > 0 ? this.text.charCodeAt(t.start - 1) : 0;
        if (prevChar === Char.Space || prevChar === Char.Tab) {
            this.builder.softAppendSpace();
        }
        this.builder.append(this.text.substring(t.start, t.end));

        const nextChar = t.end < this.text.length - 1 ? this.text.charCodeAt(t.end) : 0;
        if (nextChar === Char.Space || nextChar === Char.Tab) {
            this.builder.softAppendSpace();
        }
    }

    // tslint:disable-next-line:cyclomatic-complexity
    private isEqualsInsideArguments(index: number): boolean {
        // Since we don't have complete statement, this is mostly heuristics.
        // Therefore the code may not be handling all possible ways of the
        // argument list continuation.
        if (index < 1) {
            return false;
        }

        const prev = this.tokens.getItemAt(index - 1);
        if (prev.type !== TokenType.Identifier) {
            return false;
        }

        const first = this.tokens.getItemAt(0);
        if (first.type === TokenType.Comma) {
            return true; // Line starts with commma
        }

        const last = this.tokens.getItemAt(this.tokens.count - 1);
        if (last.type === TokenType.Comma) {
            return true; // Line ends in comma
        }

        if (last.type === TokenType.Comment && this.tokens.count > 1 && this.tokens.getItemAt(this.tokens.count - 2).type === TokenType.Comma) {
            return true; // Line ends in comma and then comment
        }

        if (this.document) {
            const prevLine = this.lineNumber > 0 ? this.document.lineAt(this.lineNumber - 1).text : '';
            const prevLineTokens = new Tokenizer().tokenize(prevLine);
            if (prevLineTokens.count > 0) {
                const lastOnPrevLine = prevLineTokens.getItemAt(prevLineTokens.count - 1);
                if (lastOnPrevLine.type === TokenType.Comma) {
                    return true; // Previous line ends in comma
                }
                if (lastOnPrevLine.type === TokenType.Comment && prevLineTokens.count > 1 && prevLineTokens.getItemAt(prevLineTokens.count - 2).type === TokenType.Comma) {
                    return true; // Previous line ends in comma and then comment
                }
            }
        }

        for (let i = 0; i < index; i += 1) {
            const t = this.tokens.getItemAt(i);
            if (this.isKeyword(t, 'lambda')) {
                return true;
            }
        }
        return this.braceCounter.isOpened(TokenType.OpenBrace);
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
    private isMultipleStatements(index: number): boolean {
        for (let i = index; i >= 0; i -= 1) {
            if (this.tokens.getItemAt(i).type === TokenType.Semicolon) {
                return true;
            }
        }
        return false;
    }
    private keywordWithSpaceAfter(s: string): boolean {
        return s === 'in' || s === 'return' || s === 'and' ||
            s === 'or' || s === 'not' || s === 'from' ||
            s === 'import' || s === 'except' || s === 'for' ||
            s === 'as' || s === 'is';
    }
    private isKeyword(t: IToken, keyword: string): boolean {
        return t.type === TokenType.Identifier && t.length === keyword.length && this.text.substr(t.start, t.length) === keyword;
    }
}
