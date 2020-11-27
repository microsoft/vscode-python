// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ITextRange, ITextRangeCollection } from './types';

export class TextRangeCollection<T extends ITextRange> implements ITextRangeCollection<T> {
    private items: T[];

    constructor(items: T[]) {
        this.items = items;
    }

    public get start(): number {
        return this.items.length > 0 ? this.items[0].start : 0;
    }

    public get end(): number {
        return this.items.length > 0 ? this.items[this.items.length - 1].end : 0;
    }

    public get length(): number {
        return this.end - this.start;
    }

    public get count(): number {
        return this.items.length;
    }

    public contains(position: number): boolean {
        return position >= this.start && position < this.end;
    }

    public getItemAt(index: number): T {
        if (index < 0 || index >= this.items.length) {
            throw new Error('index is out of range');
        }
        return this.items[index];
    }

    public getItemAtPosition(position: number): number {
        if (this.count === 0) {
            return -1;
        }
        if (position < this.start) {
            return -1;
        }
        if (position >= this.end) {
            return -1;
        }

        let min = 0;
        let max = this.count - 1;

        while (min <= max) {
            const mid = Math.floor(min + (max - min) / 2);
            const item = this.items[mid];

            if (item.start === position) {
                return mid;
            }

            if (position < item.start) {
                max = mid - 1;
            } else {
                min = mid + 1;
            }
        }
        return -1;
    }

    public getItemContaining(position: number): number {
        if (this.count === 0) {
            return -1;
        }
        if (position < this.start) {
            return -1;
        }
        if (position > this.end) {
            return -1;
        }

        let min = 0;
        let max = this.count - 1;

        while (min <= max) {
            const mid = Math.floor(min + (max - min) / 2);
            const item = this.items[mid];

            if (item.contains(position)) {
                return mid;
            }
            if (mid < this.count - 1 && item.end <= position && position < this.items[mid + 1].start) {
                return -1;
            }

            if (position < item.start) {
                max = mid - 1;
            } else {
                min = mid + 1;
            }
        }
        return -1;
    }
}
