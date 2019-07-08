// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaiPromised from 'chai-as-promised';
import { StatusBar as VSCStatusBar } from '../../../../out/smoke/vscode/areas/statusbar/statusbar';
import { Code } from '../../../../out/smoke/vscode/vscode/code';
import { IElement } from '../../../../out/smoke/vscode/vscode/driver';
import { getSelector } from '../selectors';

use(chaiPromised);

export class StatusBar extends VSCStatusBar {
    constructor(private _code: Code) {
        super(_code);
    }

    public async getPythonStatusBarElement(): Promise<IElement> {
        return this._code.waitForElement(getSelector('PythonExtensionStatusBar'));
    }
    public async pythonStatusBarElementIsNotVisible(): Promise<void> {
        await expect(this._code.waitForElement(getSelector('PythonExtensionStatusBar'), undefined, 1, 10)).to.eventually.be.rejectedWith();
    }
}
