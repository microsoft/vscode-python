// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import { localizationKeys } from '../constants';
import { IApplication, ILocalization } from '../types';

export class Localization implements ILocalization {
    private localizedStrings?: Record<string, string>;
    constructor(private readonly app: IApplication) {}
    public get(key: localizationKeys): string {
        this.initialize();
        return this.localizedStrings![key];
    }
    private initialize() {
        if (this.localizedStrings) {
            return;
        }
        const localizedJsonFile = path.join(this.app.options.extensionsPath, 'ms-python.python', 'package.nls.json');
        this.localizedStrings = JSON.parse(fs.readFileSync(localizedJsonFile).toString());
    }
}
