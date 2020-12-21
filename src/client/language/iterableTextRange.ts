// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ITextRange, ITextRangeCollection } from './types';

export class IterableTextRange<T extends ITextRange> implements Iterable<T> {
    constructor(private textRangeCollection: ITextRangeCollection<T>) {}
    public [Symbol.iterator](): Iterator<T> {
        let index = -1;

        return {
            next: (): IteratorResult<T> => {
                if (index < this.textRangeCollection.count - 1) {
                    return {
                        done: false,
                        value: this.textRangeCollection.getItemAt((index += 1)),
                    };
                } else {
                    return {
                        done: true,
                        // tslint:disable-next-line:no-any
                        value: undefined as any,
                    };
                }
            },
        };
    }
}
