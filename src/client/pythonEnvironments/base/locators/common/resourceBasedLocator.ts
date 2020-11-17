// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable-next-line:no-single-line-block-comment
/* eslint-disable max-classes-per-file */

import { Disposables, } from '../../../../common/utils/resourceLifecycle';
import { Locator } from '../../locator';

/**
 * A locator that has things to dispose.
 */
export abstract class DisposableLocator extends Locator {
    protected readonly disposables = new Disposables();

    public async dispose(): Promise<void> {
        await this.disposables.dispose();
    }
}
