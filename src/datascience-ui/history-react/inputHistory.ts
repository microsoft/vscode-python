// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { min, max } from 'lodash';

export class InputHistory {

    private history: string [];
    private pos: number = 0;
    constructor(history: string []) {
        // Make an implicit blank that we start at.
        this.history = ['', ...history];
    }

    public completeUp() : string | undefined {
        if (this.history.length) {
            this.pos = min([this.pos + 1, this.history.length -1]);
            return this.history[this.pos];
        }
    }

    public completeDown() : string {
        if (this.history.length) {
            this.pos = max([this.pos - 1, 0]);
            return this.history[this.pos];
        }
    }

    public onChange() {
        this.pos = 0;
    }
}
