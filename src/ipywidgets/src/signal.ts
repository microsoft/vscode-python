// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import { ISignal, Slot } from '@phosphor/signaling';

export class Signal<T, S> implements ISignal<T, S> {
    private slots: Set<Slot<T, S>> = new Set<Slot<T, S>>();

    // tslint:disable-next-line: no-any
    public connect(slot: Slot<T, S>, thisArg?: any): boolean {
        const bound = thisArg ? slot.bind(thisArg) : slot;
        this.slots.add(bound);
        return true;
    }
    // tslint:disable-next-line: no-any
    public disconnect(slot: Slot<T, S>, thisArg?: any): boolean {
        const bound = thisArg ? slot.bind(thisArg) : slot;
        this.slots.delete(bound);
        return true;
    }

    public fire(sender: T, args: S): void {
        this.slots.forEach(s => s(sender, args));
    }
}
