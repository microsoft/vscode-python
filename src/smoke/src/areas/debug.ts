// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Debug as VSCDebug } from '../../../../out/smoke/vscode/areas/debug/debugSmoke';
import { Commands } from '../../../../out/smoke/vscode/areas/workbench/workbench';
import { Code } from '../../../../out/smoke/vscode/vscode/code';
import { context } from '../application';
import { getSelector } from '../selectors';
import { Editor } from './editor';
import { Editors } from './editors';

export class Debug extends VSCDebug {
    constructor(code: Code, private readonly _commands: Commands, editors: Editors, private readonly _editor: Editor) {
        super(code, _commands, editors, _editor);
    }
    public async isVisible() {
        try {
            await context.app.code.waitForElement(getSelector('ExplorerActivityBar'), undefined, 2);
            return true;
        } catch {
            return false;
        }
    }
    public async waitForConfigPicker(): Promise<void> {
        const selector = '.quick-input-widget .quick-input-title';
        const label = context.app.workbench.localization.get('debug.selectConfigurationTitle');

        const elements = await context.app.code.waitForElements(selector, true,
            (eles) => eles.some(ele => ele.textContent.normalize() === label));

        if (elements.length === 0) {
            throw new Error(`Debug configuration item '${label}' not displayed`);
        }
    }
    public async selectConfiguration(configItem: string): Promise<void> {
        await context.app.workbench.quickinput.selectValue(configItem);
        await context.app.code.dispatchKeybinding('enter');
        await context.app.workbench.quickinput.waitForQuickInputClosed();
    }
    public async waitToStart() {
        // Remember the aria-hidden style should not exist.
        await context.app.code.waitForElement('div.debug-toolbar', ele => ele ? !ele.attributes.style.includes('[aria-hidden="true"]') : false);
    }
    public async waitToPause() {
        const selector = 'div.debug-toolbar .action-item .action-label.icon';
        await context.app.code.waitForElements(selector, true, eles => eles.some(ele => ele.attributes.title.includes('Continue')));
    }
    public async waitToStop(timeoutSeconds: number) {
        const retryInterval = 100;
        const totalNumberOfRetries = timeoutSeconds * 1000 / 100;
        await context.app.code.waitForElement('div.debug-toolbar[aria-hidden="true"]', undefined, retryInterval, totalNumberOfRetries);
    }
    /**
     * Override base method. This is more accurate.
     * Base method works by counting visible lines in editor.
     *
     * @param {number} lineNumber
     * @returns {Promise<void>}
     * @memberof Debug
     */
    public async setBreakpointOnLine(lineNumber: number): Promise<void> {
        // Ensure line is visible in the editor area before adding breakpoints.
        // After all, that's what a user does, brings the line into view then clicks...
        await this._editor.gotToLine(lineNumber);
        await this._commands.runCommand('Debug: Toggle Breakpoint')
    }
}
