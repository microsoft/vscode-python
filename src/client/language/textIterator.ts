// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { Position, Range, TextDocument } from 'vscode';
import { ITextIterator } from './types';

export class TextIterator implements ITextIterator {
    private text: string;

    constructor(text: string) {
        this.text = text;
    }

    public charCodeAt(index: number): number {
        if (index >= 0 && index < this.text.length) {
            return this.text.charCodeAt(index);
        }
        return 0;
    }

    public get length(): number {
        return this.text.length;
    }

    public getText(): string {
        return this.text;
    }
}

export class DocumentTextIterator implements ITextIterator {
    public readonly length: number;

    private document: TextDocument;

    constructor(document: TextDocument) {
        this.document = document;

        const lastIndex = this.document.lineCount - 1;
        const lastLine = this.document.lineAt(lastIndex);
        const end = new Position(lastIndex, lastLine.range.end.character);
        this.length = this.document.offsetAt(end);
    }

    public charCodeAt(index: number): number {
        const position = this.document.positionAt(index);
        return this.document.getText(new Range(position, position.translate(0, 1))).charCodeAt(position.character);
    }

    public getText(): string {
        return this.document.getText();
    }
}
