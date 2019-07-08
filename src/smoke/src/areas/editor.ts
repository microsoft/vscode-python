// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import { Editor as VSCEditor } from '../../../../out/smoke/vscode/areas/editor/editor';
import { QuickOpen } from '../../../../out/smoke/vscode/areas/quickopen/quickopen';
import { Commands } from '../../../../out/smoke/vscode/areas/workbench/workbench';
import { Code } from '../../../../out/smoke/vscode/vscode/code';
import { context } from '../application';
import { RetryMax5Seconds } from '../constants';
import { retry, sleep } from '../helpers';
import '../helpers/extensions';
import { getSelector } from '../selectors';
import { IWorkbench } from '../types';

// tslint:disable-next-line: no-var-requires no-require-imports
const namedRegexp = require('named-js-regexp');

// Reg Ex to get line and column number from VSC Statusbar.
// Values are `Ln 12, Col 23`
const vscLineColumnRegEx = namedRegexp('Ln (?<line>\\d+), Col (?<col>\\d+)');
// Reg Ex to get line and column number from Bootstrap Statusbar.
// Values are `12,23`
const pyBootstrapLineColumnRegEx = namedRegexp('(?<line>\\d+),(?<col>\\d+)');

export class Editor extends VSCEditor {
    constructor(code: Code, private readonly _commands: Commands, private readonly workbench: IWorkbench) {
        super(code, _commands);
    }
    public async isExplorerActivityBarVisible(): Promise<boolean> {
        try {
            await context.app.code.waitForElement(getSelector('ExplorerActivityBar'), undefined, 2);
            return true;
        } catch {
            return false;
        }
    }
    public async refreshExplorer(): Promise<void> {
        // Check what explorer is currently visible
        let commandToRunAfterRefreshingExplorer: string | undefined;
        if (await this.workbench.debug.isVisible()) {
            commandToRunAfterRefreshingExplorer = 'View: Show Debug';
        } else if (!commandToRunAfterRefreshingExplorer && await this.workbench.testExplorer.isVisible()) {
            commandToRunAfterRefreshingExplorer = 'View: Show Test';
        }

        // Refresh the explorer, its possible a new file was created, we need to ensure
        // VSC is aware of this.Else opening files in vsc fails.
        // Note: This will cause explorer to be displayed.
        await this._commands.runCommand('File: Refresh Explorer');

        // Wait for explorer to get refreshed.
        await sleep(500);

        if (commandToRunAfterRefreshingExplorer) {
            await this._commands.runCommand(commandToRunAfterRefreshingExplorer);
        }
    }
    public async gotToLine(line: number): Promise<void> {
        await context.app.workbench.quickopen.runCommand('Go to Line...');
        await context.app.workbench.quickopen.waitForQuickOpenOpened(10);
        await context.app.code.waitForSetValue(QuickOpen.QUICK_OPEN_INPUT, `:${line}`);
        await context.app.code.dispatchKeybinding('enter');
        await context.app.workbench.quickopen.waitForQuickOpenClosed();
        await this.waitForLine(line);
    }

    public async gotToColumn(columnNumber: number): Promise<void> {
        for (let i = 0; i <= columnNumber; i += 1) {
            const { column } = await this.getCurrentLineColumn();
            if (column === columnNumber) {
                return;
            }
            await context.app.code.dispatchKeybinding('right');
        }
        assert.fail(`Failed to set cursor to column ${columnNumber}`);
    }

    public async getCurrentLineColumn(): Promise<{ line: number; column: number }> {
        try {
            return await this.getCurrentLineColumnFromVSCStatusBar();
        } catch (ex) {
            console.error('Failed to get line & column with getCurrentLineColumnFromVSCStatusBar', ex);
        }
        return this.getCurrentLineColumnFromPyStatusBar();
    }
    @retry(RetryMax5Seconds)
    private async waitForLine(lineNumber: number): Promise<void> {
        const { line } = await this.getCurrentLineColumn();
        expect(line).to.equal(lineNumber, `Line number ${line} not same as expected ${lineNumber}.`);
    }
    private async getCurrentLineColumnFromVSCStatusBar(): Promise<{ line: number; column: number }> {
        const lineColumnSelector = getSelector('ColumnLineNumbnerStatusBar');
        const ele = await context.app.code.waitForElement(lineColumnSelector);
        const groups = vscLineColumnRegEx.execGroups(ele.textContent.normalize());
        return { line: parseInt(groups.line, 10), column: parseInt(groups.col, 10) };
    }
    private async getCurrentLineColumnFromPyStatusBar(): Promise<{ line: number; column: number }> {
        const lineColumnSelector = getSelector('PyBootstrapStatusBar');
        const ele = await context.app.code.waitForElement(lineColumnSelector);
        const groups = pyBootstrapLineColumnRegEx.execGroups(ele.textContent.normalize());
        return { line: parseInt(groups.line, 10), column: parseInt(groups.col, 10) };
    }

}
