// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { isWhiteSpace } from './characters';

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export class TextBuilder {
    private segments: string[] = [];

    public getText(): string {
        if (this.isLastWhiteSpace()) {
            this.segments.pop();
        }
        return this.segments.join('');
    }

    public softAppendSpace(count: number = 1): void {
        if (this.segments.length === 0) {
            return;
        }
        if (this.isLastWhiteSpace()) {
            count = count - 1;
        }
        for (let i = 0; i < count; i += 1) {
            this.segments.push(' ');
        }
    }

    public append(text: string): void {
        this.segments.push(text);
    }

    private isLastWhiteSpace(): boolean {
        return this.segments.length > 0 && this.isWhitespace(this.segments[this.segments.length - 1]);
    }

    private isWhitespace(s: string): boolean {
        for (let i = 0; i < s.length; i += 1) {
            if (!isWhiteSpace(s.charCodeAt(i))) {
                return false;
            }
        }
        return true;
    }
}
