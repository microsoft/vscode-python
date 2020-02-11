// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

export class InputHistory {
    private historyStack: string[] = [];
    private up: number | undefined;
    private down: number | undefined;
    private last: number | undefined;

    public completeUp(code: string): string {
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

    public completeDown(code: string): string {
        // If going down, move and then return something if we have a position
        if (this.historyStack.length > 0 && this.down !== undefined) {
            const result = this.historyStack[this.down];
            this.adjustCursors(this.down);
            return result;
        }

        return code;
    }

    public add(code: string, typed: boolean) {
        // Compute our new history. Behavior depends upon if the user typed it in or
        // just used the arrows

        // Only skip adding a dupe if it's the same as the top item. Otherwise
        // add it as normal.
        this.historyStack =
            this.last === 0 && this.historyStack.length > 0 && this.historyStack[this.last] === code
                ? this.historyStack
                : [code, ...this.historyStack];

        // Position is more complicated. If we typed something start over
        if (typed) {
            this.reset();
        } else {
            // We want our next up push to match the index of the item that was
            // actually entered.
            if (this.last === 0) {
                this.up = undefined;
                this.down = undefined;
            } else if (this.last) {
                this.up = this.last + 1;
                this.down = this.last - 1;
            }
        }
    }

    private reset() {
        this.up = undefined;
        this.down = undefined;
    }

    private adjustCursors(currentPos: number) {
        // Save last position we entered.
        this.last = currentPos;

        // For a single item, ony up works. But never modify it.
        if (this.historyStack.length > 1) {
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
}
