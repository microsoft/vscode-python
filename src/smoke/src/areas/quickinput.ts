// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { use } from 'chai';
import * as chaiPromised from 'chai-as-promised';
import { QuickInput as VSCQuickInput } from '../../../../out/smoke/vscode/areas/quickinput/quickinput';
import { Code } from '../../../../out/smoke/vscode/vscode/code';

use(chaiPromised);

export class QuickInput extends VSCQuickInput {
    constructor(private _code: Code) {
        super(_code);
    }

    public async selectValue(value: string): Promise<void> {
        return this._code.waitForSetValue(VSCQuickInput.QUICK_INPUT_INPUT, value);
    }
}
