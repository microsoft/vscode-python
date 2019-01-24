// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

export class InputHistory {

    private historyStack: string [] = [];
    private up: number | undefined;
    private down: number | undefined;

    public completeUp(code: string) : string {
        // If going up, only move if anything in the history
        if (this.historyStack.length > 0) {
            if (this.up === undefined) {
                this.up = 0;
            }

            const result = this.up < this.historyStack.length ? this.historyStack[this.up] : code;
            this.adjustCursors(this.up);
            return result;
        }

        return code;
    }

    public completeDown(code: string) : string {
        // If going down, move and then return something if we have a position
        if (this.historyStack.length > 0 && this.down !== undefined) {
            const result = this.historyStack[this.down];
            this.adjustCursors(this.down);
            return result;
        }

        return code;
    }

    public add(code: string) {
        // Compute our new history (dupes should reorder adding dupes)
        const dupeIndex = this.historyStack.indexOf(code);
        this.historyStack = dupeIndex >= 0 ? this.historyStack : [code, ...this.historyStack];

        // Reset position if new code
        if (dupeIndex < 0) {
            this.reset();
        }
    }

    private reset() {
        this.up = undefined;
        this.down = undefined;
    }

    private adjustCursors(currentPos: number) {
        if (currentPos < this.historyStack.length) {
            this.up = currentPos + 1;
        } else {
            this.up = this.historyStack.length;

            // If we go off the end, don't make the down go up to the last.
            // CMD prompt behaves this way. Down is always one off.
            currentPos = this.historyStack.length - 1;
        }
        if (currentPos > 0) {
            this.down = currentPos - 1;
        } else {
            this.down = undefined;
        }
    }
}
