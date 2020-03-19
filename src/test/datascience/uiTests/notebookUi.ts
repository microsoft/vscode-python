// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ElementHandle } from 'playwright';
import { waitForCondition } from '../../common';
import { BaseWebUI } from './helpers';

enum CellToolbarButton {
    run = 0
}

export class NotebookEditorUI extends BaseWebUI {
    public async assertCellCount(count: number): Promise<void> {
        await waitForCondition(
            async () => {
                const items = await this.page!.$$('.cell-wrapper');
                return items.length === count;
            },
            this.waitTimeForUIToUpdate,
            'Invalid Cell Count'
        );
    }

    public async executeCell(cellIndex: number): Promise<void> {
        const runButton = await this.getToolbarButton(cellIndex, CellToolbarButton.run);
        await runButton.click({ button: 'left' });
    }

    private async getCell(cellIndex: number): Promise<ElementHandle<Element>> {
        const items = await this.page!.$$('.cell-wrapper');
        return items[cellIndex];
    }
    private async getCellToolbar(cellIndex: number): Promise<ElementHandle<Element>> {
        const cell = await this.getCell(cellIndex);
        return cell.$$('.native-editor-celltoolbar-middle').then(items => items[0]);
    }
    private async getToolbarButton(cellIndex: number, button: CellToolbarButton): Promise<ElementHandle<Element>> {
        const toolbar = await this.getCellToolbar(cellIndex);
        return toolbar.$$('button[role=button]').then(items => items[button]);
    }
}
