// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IAttachItem, IAttachProcessProvider } from './types';

export abstract class BaseAttachProcessProvider implements IAttachProcessProvider {
    public abstract registerCommands(): void;

    public getAttachItems(): Promise<IAttachItem[]> {
        return this.getInternalProcessEntries().then(processEntries => {
            // localeCompare is significantly slower than < and > (2000 ms vs 80 ms for 10,000 elements)
            // We can change to localeCompare if this becomes an issue
            processEntries.sort((a, b) => {
                if (a.label === undefined) {
                    if (b.label === undefined) {
                        return 0;
                    }
                    return 1;
                }
                if (b.label === undefined) {
                    return -1;
                }
                const aLower = a.label.toLowerCase();
                const bLower = b.label.toLowerCase();
                if (aLower === bLower) {
                    return 0;
                }
                return aLower < bLower ? -1 : 1;
            });

            return processEntries;
        });
    }

    protected abstract getInternalProcessEntries(): Promise<IAttachItem[]>;
}
