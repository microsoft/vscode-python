// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-var-requires no-require-imports

import * as assert from 'assert';
import { RetryMax10Seconds, RetryMax2Seconds, RetryMax5Seconds } from '../constants';
import { retry, sleep } from '../helpers';
import '../helpers/extensions';
import { Selector } from '../selectors';
import { IApplication, IDocuments } from '../types';

const namedRegexp = require('named-js-regexp');

// Reg Ex to get line and column number from Bootstrap Statusbar.
// Values are `12,23`
const pyBootstrapLineColumnRegEx = namedRegexp('(?<line>\\d+),(?<col>\\d+)');

export class Documents implements IDocuments {
    constructor(private readonly app: IApplication) {}
    public async createNewUntitledFile(): Promise<void> {
        await this.app.quickopen.runCommand('File: New Untitled File');
        await this.waitForEditorFocus('Untitled-1');
    }
    public createNewFile(_fileName: string, _contents: string): Promise<void> {
        throw new Error('Method not implemented.');
    }
    @retry(RetryMax5Seconds)
    public async waitUntilFileOpened(fileName: string): Promise<void> {
        await this.waitForEditorFocus(fileName);
    }
    public isExplorerViewOpen(): Promise<boolean> {
        return this.app.driver
            .$(this.app.getCSSSelector(Selector.ExplorerActivityBar))
            .then(() => true)
            .catch(() => false);
    }
    @retry(RetryMax5Seconds)
    public async waitUntilExplorerViewOpened(): Promise<void> {
        await this.app.driver.$(this.app.getCSSSelector(Selector.ExplorerActivityBar));
    }
    @retry(RetryMax5Seconds)
    public async waitUntilExplorerViewHidden(): Promise<void> {
        const isVisible = await this.isExplorerViewOpen();
        assert.ok(!isVisible);
    }
    public async refreshExplorer(): Promise<void> {
        // Check what explorer is currently visible
        let commandToRunAfterRefreshingExplorer: string | undefined;
        if (await this.app.debugger.isDebugViewOpened()) {
            commandToRunAfterRefreshingExplorer = 'View: Show Debug';
        } else if (!commandToRunAfterRefreshingExplorer && (await this.app.testExplorer.isOpened())) {
            commandToRunAfterRefreshingExplorer = 'View: Show Test';
        }

        // Refresh the explorer, its possible a new file was created, we need to ensure
        // VSC is aware of this.Else opening files in vsc fails.
        // Note: This will cause explorer to be displayed.
        await this.app.quickopen.runCommand('File: Refresh Explorer');

        // Wait for explorer to get refreshed.
        await sleep(500);
        await this.app.quickopen.runCommand('File: Focus on Files Explorer');
        await sleep(500);
        await this.app.quickopen.runCommand('File: Refresh Explorer');
        await sleep(500);

        if (commandToRunAfterRefreshingExplorer) {
            await this.app.quickopen.runCommand(commandToRunAfterRefreshingExplorer);
        }
    }
    public async gotToPosition(options: { line: number } | { column: number } | { line: number; column: number }): Promise<void> {
        if ('line' in options) {
            await this.goToLine(options.line);
        }
        if ('column' in options) {
            await this.gotToColumn(options.column);
        }
    }
    public async waitForPosition(options: { line: number }): Promise<void> {
        if ('line' in options) {
            await this.waitForLine(options.line);
        }
    }
    public getCurrentPosition(): Promise<{ line: number; column: number }> {
        return this.getCurrentPositionFromPyBootstrapStatusBar();
    }
    public getAutoCompletionList(): Promise<string[]> {
        const selector = this.app.getCSSSelector(Selector.AutoCompletionListItem);
        return this.app.driver.$$eval(selector, elements => elements.map(element => element.textContent || '')).then(items => items.map(item => item.normalize()));
    }
    public async waitForEditorFocus(fileName: string): Promise<void> {
        await this.waitForActiveTab(fileName);
        await this.waitForActiveEditor(fileName);
    }
    public async waitForActiveEditor(filename: string): Promise<void> {
        const selector = `.editor-instance .monaco-editor[data-uri$="${escape(filename)}"] textarea`;
        await this.app.driver.waitForSelector(selector, { timeout: 5000, visible: true });
    }
    public async waitForActiveTab(fileName: string, isDirty: boolean = false): Promise<void> {
        const selector = `.tabs-container div.tab.active${isDirty ? '.dirty' : ''}[aria-selected="true"][aria-label="${fileName}, tab"]`;
        await this.app.driver.waitForSelector(selector, { timeout: 5000, visible: true });
    }
    private async gotToColumn(columnNumber: number): Promise<void> {
        for (let i = 0; i <= columnNumber; i += 1) {
            const { column } = await this.getCurrentPosition();
            if (column === columnNumber) {
                return;
            }
            await this.app.driver.press('ArrowRight');
            // Wait for UI to respond to the key press.
            await sleep(100);
        }
        assert.fail(`Failed to set cursor to column ${columnNumber}`);
    }
    @retry(RetryMax10Seconds)
    private async goToLine(line: number): Promise<void> {
        await this.app.quickopen.open();
        await this.app.quickopen.select(line.toString());
        await this.waitForLine(line);
    }
    @retry(RetryMax2Seconds)
    private async waitForLine(lineNumber: number): Promise<void> {
        const { line } = await this.getCurrentPositionFromPyBootstrapStatusBar();
        assert.equal(line, lineNumber, `Line number ${line} not same as expected ${lineNumber}.`);
    }
    private async getCurrentPositionFromPyBootstrapStatusBar(): Promise<{ line: number; column: number }> {
        const lineColumnSelector = this.app.getCSSSelector(Selector.CurrentEditorLineColumnStatusBar);
        const textContent = await this.app.driver.$eval(lineColumnSelector, ele => ele.textContent || '');
        const groups = pyBootstrapLineColumnRegEx.execGroups(textContent.normalize());
        return { line: parseInt(groups.line, 10), column: parseInt(groups.col, 10) };
    }
}
