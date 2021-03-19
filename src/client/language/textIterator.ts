// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

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
