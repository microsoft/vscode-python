// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { ElementHandle } from 'playwright-chromium';
import { sleep } from '../../../client/common/utils/async';
import { InteractiveWindowMessages } from '../../../client/datascience/interactive-common/interactiveWindowTypes';
import { INotebookEditor } from '../../../client/datascience/types';
import { BaseWebUI } from './helpers';

enum CellToolbarButton {
    run = 0
}

enum MainToolbarButton {
    clearOutput = 6
}

export class NotebookEditorUI extends BaseWebUI {
    private _editor: INotebookEditor | undefined;
    public _setEditor(editor: INotebookEditor) {
        this._editor = editor;
    }
    public async getCellCount(): Promise<number> {
        const items = await this.page!.$$('.cell-wrapper');
        return items.length;
    }

    public async clearOutput(): Promise<void> {
        const runButton = await this.getMainToolbarButton(MainToolbarButton.clearOutput);
        await runButton.click({ button: 'left', force: true, timeout: 0 });
    }

    public async executeCell(cellIndex: number): Promise<void> {
        const renderedPromise = this.waitForMessage(InteractiveWindowMessages.ExecutionRendered);
        // Make sure to wait for idle so that the button is clickable.
        await this.waitForIdle();

        // Wait just a bit longer to make sure button is visible (not sure why it isn't clicking the button sometimes)
        await sleep(500);

        // Click the run button.
        const runButton = await this.getToolbarButton(cellIndex, CellToolbarButton.run);
        // tslint:disable-next-line: no-console
        console.log(`Executing cell ${cellIndex} by clicking ${runButton.toString()}`);
        await Promise.all([runButton.click({ button: 'left', force: true, timeout: 0 }), renderedPromise]);
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

    private waitForIdle(): Promise<void> {
        if (this._editor && this._editor.notebook) {
            return this._editor.notebook.waitForIdle(60_000);
        }
        return Promise.resolve();
    }

    private async getMainToolbarButton(button: MainToolbarButton): Promise<ElementHandle<Element>> {
        // First wait for the toolbar button to be visible.
        await this.page!.waitForFunction(
            `document.querySelectorAll('.toolbar-menu-bar button[role=button]').length && document.querySelectorAll('.toolbar-menu-bar button[role=button]')[${button}].clientHeight != 0`
        );
        // Then eval the button
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
