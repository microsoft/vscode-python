// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { noop } from '../../client/common/utils/misc';

export class InputHistory {

    private history: string [];
    private pos: number | undefined;
    constructor(history: string []) {
        // History is a stack with 0 being the top
        this.history = history;
    }

    public completeUp(code: string) : string {
        // If going up, only move if anything in the history
        if (this.history.length > 0) {
            if (this.pos === undefined) {
                this.pos = 0;
            } else {
                this.move(1);
            }
            return this.history[this.pos];
        } else {
            return code;
        }
    }

    public completeDown(code: string) : string {
        // If going down, move and then return something if we have a position
        if (this.history.length > 0 && this.pos !== undefined) {
            this.move(-1);
            if (this.pos !== undefined) {
                return this.history[this.pos];
            }
        }

        return code;
    }

    public onChange() {
        noop();
    }

    private move(dir: number) {
        if (this.pos !== undefined) {
            let result : number | undefined = this.pos + dir;
            if (result >= this.history.length - 1) {
                result = this.history.length - 1;
            }
            if (result < 0) {
                result = undefined;
            }
            this.pos = result;
        }
    }
}
