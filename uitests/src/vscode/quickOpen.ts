// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import { RetryMax10Seconds, RetryMax2Seconds, RetryMax30Seconds } from '../constants';
import { noop, retry, sleep } from '../helpers';
import { debug, warn } from '../helpers/logger';
import { Selector } from '../selectors';
import { IApplication, IQuickOpen } from '../types';

// Sometimes invoking the actual command isn't exactly what we need.
// E.g. `Show Language Server Output` in extension may not be registered, so we have a wrapper
// in the bootstrap extension to wait until it is registered (until then it keeps invoking the command).
const commandReplacements: Record<string, string> = {
    'Python: Show Language Server Output': 'Smoke: Show Language Server Output Panel'
};

export class QuickOpen extends EventEmitter implements IQuickOpen {
    constructor(private readonly app: IApplication) {
        super();
    }
    public async openFile(fileName: string): Promise<void> {
        const fullFilePath = path.join(this.app.workspacePathOrFolder, fileName);
        const openFileTxt = path.join(this.app.extensionsPath, 'openFile.txt');
        const errorFile = path.join(this.app.extensionsPath, 'openFile_error.txt');
        await Promise.all([fs.remove(errorFile).catch(noop), fs.writeFile(openFileTxt, fullFilePath)]);

        await this.app.quickopen.runCommand('Smoke: Open File');
        // Wait for 5 seconds for file to get opened.
        // If file has been deleted then yes it has been opened, else error
        for (const _ of [1, 2, 3, 4, 5]) {
            if (await fs.pathExists(openFileTxt)) {
                await sleep(500);
                continue;
            }
            return;
        }

        let errorMessage = '';
        if (await fs.pathExists(errorFile)) {
            errorMessage += await fs.readFile(errorFile);
        }
        if (await fs.pathExists(openFileTxt)) {
            errorMessage += await fs.readFile(openFileTxt);
        }
        throw new Error(`Error opening file '${fullFilePath}'.\n ${errorMessage}`);

        // let retryCounter = 0;
        // const tryOpening = async () => {
        //     retryCounter += 1;
        //     // Possible VSC explorer hasn't refreshed, and it hasn't detected a new file in the file system.
        //     if (retryCounter > 1) {
        //         await this.app.documents.refreshExplorer();
        //     }
        //     // await this.runCommand('Go to File...');
        //     await this.open();
        //     await this._selectValue(fileName, fileName);
        //     await this.app.documents.waitUntilFileOpened(fileName);
        // };

        // await retryWrapper(RetryMax20Seconds, tryOpening);
    }
    /**
     * Don't know what UI element in VSC handles keyboard events.
     * (should be possible to find out, but found it easier to just use the bootstrap extension).
     * Solution:
     * - Use bootstrap extension to launch the quic open dropdown
     * - Send the text `> command name`
     * - Send the `Enter` key to the quick open window.
     *
     * @param {string} value
     * @returns {Promise<void>}
     * @memberof QuickOpen
     */
    public async runCommand(value: string): Promise<void> {
        await this._runCommand(value);
        if (this.listenerCount('command') > 0) {
            await new Promise(resolve => this.emit('command', value, resolve));
        }
    }
    public async select(value: string): Promise<void> {
        await this._selectValue(`:${value}`);
    }
    public async open(): Promise<void> {
        await this.app.driver.click(this.app.getCSSSelector(Selector.PyBootstrapStatusBar));
    }
    public async close(): Promise<void> {
        throw new Error('Not implemented');
    }
    public dispose() {
        this.removeAllListeners();
    }
    public async waitUntilOpened(_retryCount?: number): Promise<void> {
        await this.app.driver.waitForSelector(this.app.getCSSSelector(Selector.QuickOpenInput));
    }
    public async waitUntilClosed(): Promise<void> {
        await this.app.driver.waitForSelector(this.app.getCSSSelector(Selector.QuickOpenInput), { hidden: true }).catch(warn.bind(warn, 'Quick Open not hidden'));
    }
    @retry(RetryMax30Seconds)
    private async _runCommand(command: string): Promise<void> {
        // Use a replacement command.
        command = commandReplacements[command] || command;
        debug(`Run command ${command}`);
        debug(' - display quick open');
        await this.open();
        await this._selectValue(`> ${command}`, command);
    }
    /**
     * Keep retrying (possible things didn't get typed in correctly as something else stole focus).
     *
     * @private
     * @param {string} valueToType
     * @param {string} [valueToGetSelected]
     * @returns {Promise<void>}
     * @memberof QuickOpen
     */
    @retry(RetryMax10Seconds)
    private async _selectValue(valueToType: string, valueToGetSelected?: string): Promise<void> {
        await this.waitUntilOpened();
        debug(' - type into input');
        const selector = this.app.getCSSSelector(Selector.QuickOpenInput);
        await this.app.driver.type(selector, valueToType);
        if (valueToGetSelected) {
            debug(' - wait until item is selected');
            await this.waitUntilSelected(valueToGetSelected).catch(async ex => {
                // Close the quick open before we try to re-open (as part of retry operations).
                await this.app.driver.press('Escape');
                throw ex;
            });
        }
        await this.app.driver.press('Enter');
        await this.waitUntilClosed();
    }
    /**
     * Waits until the provided value has been selected in the quick input dropdown.
     * Convert values to lower case to avoid instances where command names are not written in the exact case.
     *
     * @private
     * @param {string} value
     * @returns {Promise<void>}
     * @memberof QuickOpen
     */
    @retry(RetryMax2Seconds)
    private async waitUntilSelected(value: string): Promise<void> {
        value = value.toLowerCase();
        // If the first highlighted item is exactly what we need, then use that.
        // For some reason VSC seems to display the item in the quick open in a funky way.
        // If we retry it will work, but why waste cpu cycles, lets accomodate for this funky state.
        const [highlightedItems, highlightedItem2s] = await Promise.all([
            this.app.driver.$$eval(this.app.getCSSSelector(Selector.QuickOpenEntryLabelFocused), elements => elements.map(e => (e.textContent || '').toLowerCase())),
            this.app.driver.$$eval(this.app.getCSSSelector(Selector.QuickOpenEntryLabelFocused2), elements => elements.map(e => (e.textContent || '').toLowerCase()))
        ]);
        if (Array.isArray(highlightedItems) && highlightedItems.length > 0 && (highlightedItems[0] || '').normalize() === value) {
            debug(' - Command highlighted in quick open');
            return;
        }
        if (Array.isArray(highlightedItem2s) && highlightedItem2s.length > 0 && (highlightedItem2s[0] || '').normalize() === value) {
            debug(' - Command highlighted in quick open');
            return;
        }
        throw new Error(`Item '${value}' not found in quick open, lets wait for some more time. Items found ${highlightedItems.join(', ')} & ${highlightedItem2s.join(', ')}.`);
    }
}
