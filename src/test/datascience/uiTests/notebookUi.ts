// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { ElementHandle } from 'playwright-chromium';
import { InteractiveWindowMessages } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { CommonActionType } from '../../../datascience-ui/interactive-common/redux/reducers/types';
import { BaseWebUI } from './helpers';

enum CellToolbarButton {
    run = 0
}

enum MainToolbarButton {
    clearOutput = 6
}

export class NotebookEditorUI extends BaseWebUI {
    public async getCellCount(): Promise<number> {
        const items = await this.page!.$$('.cell-wrapper');
        return items.length;
    }

    public async clearOutput(): Promise<void> {
        const runButton = await this.getMainToolbarButton(MainToolbarButton.clearOutput);
        await runButton.click({ button: 'left' });
    }

    public async executeCell(cellIndex: number): Promise<void> {
        const renderedPromise = this.waitForMessage(InteractiveWindowMessages.ExecutionRendered);
        const executedPromise = this.waitForMessage(CommonActionType.EXECUTE_CELL);
        const runButton = await this.getToolbarButton(cellIndex, CellToolbarButton.run);
        await Promise.all([runButton.click({ button: 'left' }), renderedPromise, executedPromise]);
    }

    public async cellHasOutput(cellIndex: number): Promise<boolean> {
        const cell = await this.getCell(cellIndex);
        const output = await cell.$$('.cell-output-wrapper');
        return output.length > 0;
    }

    public async getCellOutputHTML(cellIndex: number): Promise<string> {
        const output = await this.getCellOutput(cellIndex);
        const outputHtml = await output.getProperty('innerHTML');
        return outputHtml?.toString() || '';
    }

    public async getCellOutput(cellIndex: number): Promise<ElementHandle<Element>> {
        const cell = await this.getCell(cellIndex);
        const output = await cell.$$('.cell-output-wrapper');
        if (output.length === 0) {
            assert.fail('Cell does not have any output');
        }
        return output[0];
    }

    public async getCell(cellIndex: number): Promise<ElementHandle<Element>> {
        const items = await this.page!.$$('.cell-wrapper');
        return items[cellIndex];
    }
    private async getMainToolbarButton(button: MainToolbarButton): Promise<ElementHandle<Element>> {
        const buttons = await this.page!.$$('.toolbar-menu-bar button[role=button]');
        if (buttons.length === 0) {
            assert.fail('Main toolbar Buttons not available');
        }
        return buttons[button];
    }
    private async getCellToolbar(cellIndex: number): Promise<ElementHandle<Element>> {
        const cell = await this.getCell(cellIndex);
        return cell.$$('.native-editor-celltoolbar-middle').then((items) => items[0]);
    }
    private async getToolbarButton(cellIndex: number, button: CellToolbarButton): Promise<ElementHandle<Element>> {
        const toolbar = await this.getCellToolbar(cellIndex);
        return toolbar.$$('button[role=button]').then((items) => items[button]);
    }
}
