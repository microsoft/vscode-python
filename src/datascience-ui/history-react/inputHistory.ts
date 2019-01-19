// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

export class InputHistory {

    private history: string [];
    private pos: number = 0;
    constructor(history: string []) {
        // Make an implicit blank that we start at.
        this.history = ['', ...history];
    }

    public completeUp() : string {
        if (this.history.length) {
            this.pos = this.pos >= this.history.length - 1 ? this.history.length - 1 : this.pos + 1;
            return this.history[this.pos];
        }

        return '';
    }

    public completeDown() : string {
        if (this.history.length) {
            this.pos = this.pos > 0 ? this.pos - 1 : 0;
            return this.history[this.pos];
        }

        return '';
    }

    public onChange() {
        this.pos = 0;
    }
}
