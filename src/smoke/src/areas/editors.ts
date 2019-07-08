// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Editors as VSCEditors } from '../../../../out/smoke/vscode/areas/editor/editors';
import { Code } from '../../../../out/smoke/vscode/vscode/code';
import { context } from '../application';

export class Editors extends VSCEditors {
    constructor(code: Code) {
        super(code);
    }
    /**
     * Wait for a file to open.
     * In the case of debugging, the focus may not be on the file, it could be on the debug toolbar or the like.
     *
     * @param {string} fileName
     * @param {boolean} [shouldBeActiveFile=true]
     * @returns {Promise<void>}
     * @memberof Editors
     */
    public async waitForFileToOpen(fileName: string): Promise<void> {
        await this.waitForActiveTab(fileName);
        const selector = `.editor-instance .monaco-editor[data-uri$="${escape(fileName)}"] textarea`;
        await context.app.code.waitForElement(selector);
    }
}
