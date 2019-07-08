// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs-extra';
import * as path from 'path';
import { extensionRootPath } from '../constants';

export class Localization {
    private localizedStrings: Record<string, string> = {};
    constructor() {
        this.extractLocalizedStrings();
    }
    public get(key: string) {
        return this.localizedStrings[key];
    }
    private extractLocalizedStrings() {
        const locFile = path.join(extensionRootPath, 'package.nls.json');
        this.localizedStrings = JSON.parse(fs.readFileSync(locFile, 'utf-8'));
    }
}
