// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:import-name
import Char from 'typescript-char';
import { Position, Range, TextDocument } from 'vscode';
import { BraceCounter } from '../language/braceCounter';
import { TextBuilder } from '../language/textBuilder';
import { TextRangeCollection } from '../language/textRangeCollection';
import { Tokenizer } from '../language/tokenizer';
import { ITextRangeCollection, IToken, TokenType } from '../language/types';

const keywordsWithSpaceBeforeBrace = [
    'and',
    'as',
    'assert',
    'await',
    'del',
    'except',
    'elif',
    'for',
    'from',
    'global',
    'if',
    'import',
    'in',
    'is',
    'lambda',
    'nonlocal',
    'not',
    'or',
    'raise',
    'return',
    'while',
    'with',
    'yield',
];

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
                    if (
                        prev &&
                        !this.isOpenBraceType(prev.type) &&
                        prev.type !== TokenType.Colon &&
                        prev.type !== TokenType.Operator
                    ) {
                        this.builder.softAppendSpace();
                    }
                    const id = this.text.substring(t.start, t.end);
                    this.builder.append(id);
                    if (this.isKeywordWithSpaceBeforeBrace(id) && next && this.isOpenBraceType(next.type)) {
                        // for x in ()
                        this.builder.softAppendSpace();
                    }
                    break;

                case TokenType.Colon:
                    // x: 1 if not in slice, x[1:y] if inside the slice.
                    this.builder.append(':');
                    if (!this.braceCounter.isOpened(TokenType.OpenBracket) && next && next.type !== TokenType.Colon) {
                        // Not inside opened [[ ... ] sequence.
                        this.builder.softAppendSpace();
                    }
                    break;

                case TokenType.Comment:
                    // Add 2 spaces before in-line comment per PEP guidelines.
                    if (prev) {
                        this.builder.softAppendSpace(2);
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
        const opCode = this.text.charCodeAt(t.start);
        const next = index < this.tokens.count - 1 ? this.tokens.getItemAt(index + 1) : undefined;

        if (t.length === 1) {
            switch (opCode) {
                case Char.Equal:
                    this.handleEqual(t, index);
                    return;
                case Char.Period:
                    if (prev && this.isKeyword(prev, 'from')) {
                        this.builder.softAppendSpace();
                    }
                    this.builder.append('.');
                    if (next && this.isKeyword(next, 'import')) {
                        this.builder.softAppendSpace();
                    }
                    return;
                case Char.At:
                    if (prev) {
                        // Binary case
                        this.builder.softAppendSpace();
                        this.builder.append('@');
                        this.builder.softAppendSpace();
                    } else {
                        this.builder.append('@');
                    }
                    return;
                case Char.ExclamationMark:
                    this.builder.append('!');
                    return;
                case Char.Asterisk:
                    if (prev && this.isKeyword(prev, 'lambda')) {
                        this.builder.softAppendSpace();
                        this.builder.append('*');
                        return;
                    }
                    if (this.handleStarOperator(t, prev!)) {
                        return;
                    }
                    break;
                default:
                    break;
            }
        } else if (t.length === 2) {
            if (
                this.text.charCodeAt(t.start) === Char.Asterisk &&
                this.text.charCodeAt(t.start + 1) === Char.Asterisk
            ) {
                if (this.handleStarOperator(t, prev!)) {
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

        // Check unary case
        if (prev && prev.type === TokenType.Operator) {
            if (opCode === Char.Hyphen || opCode === Char.Plus || opCode === Char.Tilde) {
                return;
            }
        }
        this.builder.softAppendSpace();
    }

    private handleStarOperator(current: IToken, prev: IToken): boolean {
        if (
            this.text.charCodeAt(current.start) === Char.Asterisk &&
            this.text.charCodeAt(current.start + 1) === Char.Asterisk
        ) {
            if (!prev || (prev.type !== TokenType.Identifier && prev.type !== TokenType.Number)) {
                this.builder.append('**');
                return true;
            }
            if (prev && this.isKeyword(prev, 'lambda')) {
                this.builder.softAppendSpace();
                this.builder.append('**');
                return true;
            }
        }
        // Check previous line for the **/* condition
        const lastLine = this.getPreviousLineTokens();
        const lastToken = lastLine && lastLine.count > 0 ? lastLine.getItemAt(lastLine.count - 1) : undefined;
        if (lastToken && (this.isOpenBraceType(lastToken.type) || lastToken.type === TokenType.Comma)) {
            this.builder.append(this.text.substring(current.start, current.end));
            return true;
        }
        return false;
    }

    private handleEqual(_t: IToken, index: number): void {
        if (this.isMultipleStatements(index) && !this.braceCounter.isOpened(TokenType.OpenBrace)) {
            // x = 1; x, y = y, x
            this.builder.softAppendSpace();
            this.builder.append('=');
            this.builder.softAppendSpace();
            return;
        }

        // Check if this is = in function arguments. If so, do not add spaces around it.
        if (this.isEqualsInsideArguments(index)) {
            this.builder.append('=');
            return;
        }

        this.builder.softAppendSpace();
        this.builder.append('=');
        this.builder.softAppendSpace();
    }

    private handleOther(t: IToken, index: number): void {
        if (this.isBraceType(t.type)) {
            this.braceCounter.countBrace(t);
            this.builder.append(this.text.substring(t.start, t.end));
            return;
        }

        const prev = index > 0 ? this.tokens.getItemAt(index - 1) : undefined;
        if (
            prev &&
            prev.length === 1 &&
            this.text.charCodeAt(prev.start) === Char.Equal &&
            this.isEqualsInsideArguments(index - 1)
        ) {
            // Don't add space around = inside function arguments.
            this.builder.append(this.text.substring(t.start, t.end));
            return;
        }

        if (prev && (this.isOpenBraceType(prev.type) || prev.type === TokenType.Colon)) {
            // Don't insert space after (, [ or { .
            this.builder.append(this.text.substring(t.start, t.end));
            return;
        }

        if (
            t.type === TokenType.Number &&
            prev &&
            prev.type === TokenType.Operator &&
            prev.length === 1 &&
            this.text.charCodeAt(prev.start) === Char.Tilde
        ) {
            // Special case for ~ before numbers
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
        if (index < 1) {
            return false;
        }

        // We are looking for IDENT = ?
        const prev = this.tokens.getItemAt(index - 1);
        if (prev.type !== TokenType.Identifier) {
            return false;
        }

        if (index > 1 && this.tokens.getItemAt(index - 2).type === TokenType.Colon) {
            return false; // Type hint should have spaces around like foo(x: int = 1) per PEP 8
        }

        return this.isInsideFunctionArguments(this.tokens.getItemAt(index).start);
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

    private isKeywordWithSpaceBeforeBrace(s: string): boolean {
        return keywordsWithSpaceBeforeBrace.indexOf(s) >= 0;
    }
    private isKeyword(t: IToken, keyword: string): boolean {
        return (
            t.type === TokenType.Identifier &&
            t.length === keyword.length &&
            this.text.substr(t.start, t.length) === keyword
        );
    }

    // tslint:disable-next-line:cyclomatic-complexity
    private isInsideFunctionArguments(position: number): boolean {
        if (!this.document) {
            return false; // unable to determine
        }

        // Walk up until beginning of the document or line with 'def IDENT(' or line ending with :
        // IDENT( by itself is not reliable since they can be nested in IDENT(IDENT(a), x=1)
        let start = new Position(0, 0);
        for (let i = this.lineNumber; i >= 0; i -= 1) {
            const line = this.document.lineAt(i);
            const lineTokens = new Tokenizer().tokenize(line.text);
            if (lineTokens.count === 0) {
                continue;
            }
            // 'def IDENT('
            const first = lineTokens.getItemAt(0);
            if (
                lineTokens.count >= 3 &&
                first.length === 3 &&
                line.text.substr(first.start, first.length) === 'def' &&
                lineTokens.getItemAt(1).type === TokenType.Identifier &&
                lineTokens.getItemAt(2).type === TokenType.OpenBrace
            ) {
                start = line.range.start;
                break;
            }

            if (lineTokens.count > 0 && i < this.lineNumber) {
                // One of previous lines ends with :
                const last = lineTokens.getItemAt(lineTokens.count - 1);
                if (last.type === TokenType.Colon) {
                    start = this.document.lineAt(i + 1).range.start;
                    break;
                } else if (lineTokens.count > 1) {
                    const beforeLast = lineTokens.getItemAt(lineTokens.count - 2);
                    if (beforeLast.type === TokenType.Colon && last.type === TokenType.Comment) {
                        start = this.document.lineAt(i + 1).range.start;
                        break;
                    }
                }
            }
        }

        // Now tokenize from the nearest reasonable point
        const currentLine = this.document.lineAt(this.lineNumber);
        const text = this.document.getText(new Range(start, currentLine.range.end));
        const tokens = new Tokenizer().tokenize(text);

        // Translate position in the line being formatted to the position in the tokenized block
        position = this.document.offsetAt(currentLine.range.start) + position - this.document.offsetAt(start);

        // Walk tokens locating narrowest function signature as in IDENT( | )
        let funcCallStartIndex = -1;
        let funcCallEndIndex = -1;
        for (let i = 0; i < tokens.count - 1; i += 1) {
            const t = tokens.getItemAt(i);
            if (t.type === TokenType.Identifier) {
                const next = tokens.getItemAt(i + 1);
                if (
                    next.type === TokenType.OpenBrace &&
                    !this.isKeywordWithSpaceBeforeBrace(text.substr(t.start, t.length))
                ) {
                    // We are at IDENT(, try and locate the closing brace
                    let closeBraceIndex = this.findClosingBrace(tokens, i + 1);
                    // Closing brace is not required in case construct is not yet terminated
                    closeBraceIndex = closeBraceIndex > 0 ? closeBraceIndex : tokens.count - 1;
                    // Are we in range?
                    if (position > next.start && position < tokens.getItemAt(closeBraceIndex).start) {
                        funcCallStartIndex = i;
                        funcCallEndIndex = closeBraceIndex;
                    }
                }
            }
        }
        // Did we find anything?
        if (funcCallStartIndex < 0) {
            // No? See if we are between 'lambda' and ':'
            for (let i = 0; i < tokens.count; i += 1) {
                const t = tokens.getItemAt(i);
                if (t.type === TokenType.Identifier && text.substr(t.start, t.length) === 'lambda') {
                    if (position < t.start) {
                        break; // Position is before the nearest 'lambda'
                    }
                    let colonIndex = this.findNearestColon(tokens, i + 1);
                    // Closing : is not required in case construct is not yet terminated
                    colonIndex = colonIndex > 0 ? colonIndex : tokens.count - 1;
                    if (position > t.start && position < tokens.getItemAt(colonIndex).start) {
                        funcCallStartIndex = i;
                        funcCallEndIndex = colonIndex;
                    }
                }
            }
        }
        return funcCallStartIndex >= 0 && funcCallEndIndex > 0;
    }

    private findNearestColon(tokens: ITextRangeCollection<IToken>, index: number): number {
        for (let i = index; i < tokens.count; i += 1) {
            if (tokens.getItemAt(i).type === TokenType.Colon) {
                return i;
            }
        }
        return -1;
    }

    private findClosingBrace(tokens: ITextRangeCollection<IToken>, index: number): number {
        const braceCounter = new BraceCounter();
        for (let i = index; i < tokens.count; i += 1) {
            const t = tokens.getItemAt(i);
            if (t.type === TokenType.OpenBrace || t.type === TokenType.CloseBrace) {
                braceCounter.countBrace(t);
            }
            if (braceCounter.count === 0) {
                return i;
            }
        }
        return -1;
    }

    private getPreviousLineTokens(): ITextRangeCollection<IToken> | undefined {
        if (!this.document || this.lineNumber === 0) {
            return undefined; // unable to determine
        }
        const line = this.document.lineAt(this.lineNumber - 1);
        return new Tokenizer().tokenize(line.text);
    }
}
