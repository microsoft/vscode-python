// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-require-imports no-var-requires
const opn = require('opn');

import { injectable } from 'inversify';
import { IBrowserService } from '../types';

export function launch(url: string) {
    opn(url);
}

@injectable()
export class BrowserService implements IBrowserService {
    public launch(url: string): void {
        launch(url);
    }
}
