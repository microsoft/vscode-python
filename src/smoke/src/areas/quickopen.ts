// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { QuickOpen as VSCQuickOpen } from '../../../../out/smoke/vscode/areas/quickopen/quickopen';
import { Code } from '../../../../out/smoke/vscode/vscode/code';
import { context } from '../application';
import { Editors } from './editors';

export class QuickOpen extends VSCQuickOpen {
    constructor(code: Code, editors: Editors) {
        super(code, editors);
    }

    // tslint:disable-next-line: no-unnecessary-override
    public async openFile(fileName: string): Promise<void> {
        await context.app.workbench.editor.refreshExplorer();
        return super.openFile(fileName);
    }
}
