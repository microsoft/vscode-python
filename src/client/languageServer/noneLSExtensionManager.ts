// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/* eslint-disable class-methods-use-this */

import { ILanguageServerExtensionManager } from './types';

export class NoneLSExtensionManager implements ILanguageServerExtensionManager {
    dispose(): void {
        // Nothing to do here.
    }

    startLanguageServer(): Promise<void> {
        return Promise.resolve();
    }

    stopLanguageServer(): void {
        // Nothing to do here.
    }

    canStartLanguageServer(): boolean {
        return true;
    }
}
