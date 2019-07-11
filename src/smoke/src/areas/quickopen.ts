// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { QuickOpen as VSCQuickOpen } from '../../../../out/smoke/vscode/areas/quickopen/quickopen';
import { Code } from '../../../../out/smoke/vscode/vscode/code';
import { context } from '../application';
import { noop, sleep } from '../helpers';
import { Editors } from './editors';

export class QuickOpen extends VSCQuickOpen {
    constructor(code: Code, editors: Editors) {
        super(code, editors);
    }

    // tslint:disable-next-line: no-unnecessary-override
    public async openFile(fileName: string): Promise<void> {
        let viewToDisplay: string | undefined = 'View: Show Debug';
        if (!await context.app.workbench.debug.isVisible()) {
            if (await context.app.workbench.testExplorer.isVisible()) {
                viewToDisplay = 'View: Show Test';
            } else {
                viewToDisplay = undefined;
            }
        }
        // Ensure the file is visible in the explorer so we can open it.
        await context.app.workbench.quickopen.runCommand('File: Refresh Explorer');
        await sleep(500);
        await context.app.workbench.quickopen.runCommand('File: Focus on Files Explorer');
        await sleep(500);
        await context.app.workbench.quickopen.runCommand('File: Refresh Explorer');
        await sleep(500);
        try {
            await super.openFile(fileName);
        } finally {
            // Restore the view.
            if (viewToDisplay) {
                await this.runCommand(viewToDisplay).catch(noop);
            }
        }
    }
}
