// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Browser, ClickOptions, ElementHandle, launch, Page, UnwrapElementHandle, WrapElementHandle } from 'puppeteer-core';
import { URI } from 'vscode-uri';
import { isCI } from '../constants';
import { noop, RetryOptions, retryWrapper, sleep } from '../helpers';
import { debug, warn } from '../helpers/logger';
import { getSelector, Selector } from '../selectors';
import { ElementsSelectorPredicate, IDriver, ITestOptions, SelectorRetryOptions, WaitForSelectorOptions, WaitForSelectorOptionsHidden } from '../types';
import { getVSCodeElectronPath } from './downloader';

// Time to wait for UI to react to user typing in a textbox.
// If its too low (then VSC UI won't have enough time to react the keys being typed into the input boxes).
// 100ms seems to be the sweetspot (any slower, then UI tests will be slow).
// Right now using 100ms seems to be enough, 50ms might be enough as well, but 100ms works.
const waitTimeoutAfterTypging = 100;

/*
 Hacky way to translate control keys into puppeteer keys.
 Better way would be to wrap this up with a class.
(plenty of places to get inspiration from .NET, Java, Flex, etc)...
 Current approach is quite sloppy.
*/
const KeyTranslations: Record<string, string> = {
    alt: 'Alt',
    control: 'Control',
    ctrl: 'Control',
    shift: 'Shift',
    space: 'Space',
    Escape: 'Escape',
    escape: 'Escape',
    esc: 'Escape',
    Enter: 'Enter',
    enter: 'Enter',
    down: 'ArrowDown',
    right: 'ArrowRight',
    left: 'ArrowLeft',
    tab: 'Tab'
};

/**
 * Given a key (control key or standard alphanumeric character),
 *  convert them into a key understoon by puppeteer.
 *
 * @param {string} key
 * @returns {string}
 */
function normalizeKey(key: string): string {
    return key in KeyTranslations ? KeyTranslations[key] : key;
}

/**
 * This is what loads VS Code.
 * VS Code is launched using puppeteer and provides the ability to run CSS queries against the dom and perform UI actions.
 * This is the heart of the UI test.
 *
 * @export
 * @class Driver
 * @extends {EventEmitter}
 * @implements {IDriver}
 */
export class Driver extends EventEmitter implements IDriver {
    public get isAlive(): boolean {
        return this.process && !this.process.killed ? true : false;
    }
    private process?: ChildProcess;
    private browser!: Browser;
    private pages!: Page[];
    private mainPage!: Page;
    private readonly options: ITestOptions;
    constructor(options: ITestOptions) {
        super();
        this.options = options;
    }
    /**
     * Given the `SelectorRetryOptions`, and an error message, convert it into `RetryOptions`.
     * This will be used to retry querying the UI using the `retryWrapper` or `retry` decorator.
     *
     * @private
     * @static
     * @param {SelectorRetryOptions} options
     * @param {string} fallbackErrorMessage
     * @returns {RetryOptions}
     * @memberof Driver
     */
    private static toRetryOptions(options: SelectorRetryOptions, fallbackErrorMessage: string): RetryOptions {
        if ('retryTimeout' in options) {
            return {
                timeout: options.retryTimeout,
                errorMessage: options.errorMessage || fallbackErrorMessage,
                logFailures: options.logFailures
            };
        } else {
            return {
                count: options.retryCount,
                errorMessage: options.errorMessage || fallbackErrorMessage,
                logFailures: options.logFailures
            };
        }
    }
    /**
     * Starts VS Code.
     *
     * @returns {Promise<void>}
     * @memberof Driver
     */
    public async start(): Promise<void> {
        if (this.process) {
            debug('Killing existing instance before starting VS Code');
            await this.exit().catch(warn);
        }
        const electronPath = getVSCodeElectronPath(this.options.channel, this.options.testPath);
        // If on CI, run in headless mode.
        const ciArgs = isCI ? ['--headless'] : [];
        const args = [
            ...ciArgs,
            `--user-data-dir=${this.options.userDataPath}`,
            `--extensions-dir=${this.options.extensionsPath}`,
            '--skip-getting-started',
            '--skip-release-notes',
            '--sticky-quickopen',
            '--disable-telemetry',
            '--disable-updates',
            '--disable-crash-reporter',
            '--no-sandbox',
            '--no-first-run',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            `--folder-uri=${URI.file(this.options.workspacePathOrFolder)}`
        ];
        debug(`Launching via puppeteer with electron path ${electronPath} & args ${args.join('\n')}`);
        this.browser = await launch({
            executablePath: electronPath,
            args,
            headless: true,
            devtools: false,
            // This must be set to `null`, else VSC UI resizes in a funky way.
            // tslint:disable-next-line: no-null-keyword
            defaultViewport: null,
            // This must be set to ensure puppeteer doesn't send default (additional) args.
            ignoreDefaultArgs: true
        });
        this.process = this.browser.process();
        this.process.on('exit', this.emit.bind(this, 'exit'));

        debug(`Launched with process ${this.process.pid}`);

        this.pages = await this.browser.pages();
        this.pages.forEach(page => {
            page.on('error', error => warn('One of the pages have errored', error));
        });
        this.mainPage = this.pages[0];
        // We know it will take at least 1 second, so lets wait for 1 second, no point trying before then.
        await sleep(1000);

        // Wait for bootstrap extension to load (when this extension is ready, that means VSC is ready for user interaction).
        // Based on assumption that if extensions have been activated, then VSC is ready for user interaction.
        // Note: This extension loads very quickly (nothing in activation method to slow activation).
        debug('Wait for bootstrap extension to actiavte');
        await this.waitForSelector(getSelector(Selector.PyBootstrapStatusBar, this.options.channel), {
            timeout: 15_000,
            visible: true
        });
        debug('VS Code successfully launched');
    }
    public async captureScreenshot(filename: string): Promise<Buffer> {
        return this.mainPage.screenshot({ path: filename });
    }
    public async exit(): Promise<void> {
        if (!this.process) {
            return;
        }
        this.removeAllListeners();
        debug('Shutting down vscode driver');
        await this.browser.close().catch(warn);
        try {
            if (this.process.connected && this.process) {
                // If exiting failed, kill the underlying process.
                process.kill(this.process.pid);
            }
        } catch {
            noop();
        }
        this.process = undefined;
    }
    public async waitForSelector(selector: string, options?: WaitForSelectorOptions): Promise<ElementHandle>;
    public async waitForSelector(selector: string, options?: WaitForSelectorOptionsHidden): Promise<ElementHandle | undefined>;
    public async waitForSelector(
        selector: string,
        options?: WaitForSelectorOptions | WaitForSelectorOptionsHidden
        // tslint:disable-next-line: no-any
    ): Promise<any> {
        if (options && 'hidden' in options && options.hidden === true) {
            // We expect selector to be available.
            return this.mainPage.waitForSelector(selector, { timeout: 3000, ...options });
        }
        // We expect selector to be available.
        return this.mainPage.waitForSelector(selector, { visible: true, timeout: 3000, ...options });
    }
    // tslint:disable-next-line: no-any
    public async $(selector: string, options?: SelectorRetryOptions): Promise<any> {
        if (!options) {
            return this.mainPage.$(selector).then(ele => (ele ? Promise.resolve(ele) : Promise.reject(new Error(`Element not found with selector '${selector}'`))));
        }
        const wrapper = async (): Promise<ElementHandle> => {
            const ele = await this.mainPage.$(selector);
            if (ele) {
                return ele;
            }
            debug(`Element not found for selector '${selector}', will retry.`);
            throw new Error('Element not found, keep retrying');
        };
        return retryWrapper(Driver.toRetryOptions(options, `Failed to find for selector '${selector}'`), wrapper);
    }
    public async $$(selector: string, options?: SelectorRetryOptions & { predicate?: ElementsSelectorPredicate }): Promise<ElementHandle[]> {
        if (!options) {
            return this.mainPage.$$(selector);
        }
        const wrapper = async (): Promise<ElementHandle[]> => {
            let eles = await this.mainPage.$$(selector);
            if (eles.length > 0 && options.predicate) {
                eles = options.predicate(eles);
            }
            if (eles.length > 0) {
                return eles;
            }
            debug(`Elements not found for selector '${selector}', will retry.`);
            throw new Error('Elements not found, keep retrying');
        };

        return retryWrapper(Driver.toRetryOptions(options, `Failed to find for selector '${selector}'`), wrapper);
    }
    public $eval<R>(selector: string, pageFunction: (element: Element) => R | Promise<R>): Promise<WrapElementHandle<R>>;
    public $eval<R, X1>(selector: string, pageFunction: (element: Element, x1: UnwrapElementHandle<X1>) => R | Promise<R>, x1: X1): Promise<WrapElementHandle<R>>;
    // tslint:disable-next-line: no-any
    public $eval(selector: any, pageFunction: any, x1?: any) {
        if (arguments.length === 3) {
            return this.mainPage.$eval(selector, pageFunction, x1);
        }
        return this.mainPage.$eval(selector, pageFunction);
    }

    public $$eval<R>(selector: string, pageFunction: (elements: Element[]) => R | Promise<R>): Promise<WrapElementHandle<R>>;
    public $$eval<R, X1>(selector: string, pageFunction: (elements: Element[], x1: UnwrapElementHandle<X1>) => R | Promise<R>, x1: X1): Promise<WrapElementHandle<R>>;
    // tslint:disable-next-line: no-any
    public $$eval(selector: any, pageFunction: any, x1?: any) {
        return this.mainPage.$$eval(selector, pageFunction, x1);
    }

    public async click(selector: string, options?: ClickOptions & SelectorRetryOptions): Promise<void> {
        if (!options || (!('retryTimeout' in options) && !('retryCount' in options))) {
            return this.mainPage.click(selector, options);
        }
        const wrapper = async (): Promise<void> => {
            // Click will throw an error if selector is invalid or element is not found.
            await this.mainPage.click(selector, options).catch(ex => {
                debug(`Element not found for selector '${selector}', will retry.`);
                return Promise.reject(ex);
            });
        };

        return retryWrapper(Driver.toRetryOptions(options, `Failed to click for selector '${selector}'`), wrapper);
    }
    public async focus(selector: string): Promise<void> {
        // Ensure element exists before setting focus.
        await this.waitForSelector(selector, { timeout: 500, visible: true });
        return this.mainPage.focus(selector);
    }
    public async hover(selector: string): Promise<void> {
        // Ensure element exists before hovering over it.
        await this.waitForSelector(selector, { timeout: 500, visible: true });
        return this.mainPage.hover(selector);
    }
    public async type(selector: string, text: string, options?: { delay: number }): Promise<void> {
        // Focus the element before typing into it.
        await this.focus(selector);
        await this.mainPage.type(selector, text, options);
        // Wait for text to be typed in (sometimes having this delay helps).
        // Not doing this sometimes results in value not being entered in input box.
        // Hopefully we don't need bigger delays on CI.
        // Cause is the fact that typing into thie textbox causes vscode to filter
        //  the dropdown list. If we don't waait long enough, then an item isn't selected
        //  in the dropdown list, meaning the necessary action isn't performed.
        // Works much like an html dropdown, we need to wait for UI to react to the input
        //  before we can hit the enter key.
        // We don't need this delay when selecting files from quickopen or selecting
        //  commands from quick open, as we wait for those items to get highlighted in the dropdown.
        // Here we're not waiting for someting to get highlighted, that's where the problem lies.
        await sleep(waitTimeoutAfterTypging);
    }
    public async press(keys: string, options?: { delay: number }): Promise<void> {
        debug(`Press key combination ${keys}`);
        const individualKeys = keys.split('+').map(normalizeKey);
        try {
            const pressUpControlKeys: string[] = [];
            for (const key of individualKeys) {
                if (['Control', 'Shift'].includes(key)) {
                    debug(`Down ${key}`);
                    await this.mainPage.keyboard.down(key);
                    pressUpControlKeys.push(key);
                    continue;
                }
                debug(`Press ${key}`);
                await this.mainPage.keyboard.press(key, options);
            }
            while (pressUpControlKeys.length) {
                const key = pressUpControlKeys.shift();
                if (key) {
                    debug(`Up ${key}`);
                    await this.mainPage.keyboard.up(key);
                }
            }
        } finally {
            await sleep(waitTimeoutAfterTypging);
        }
        // Key(s) was pressed, lets wait for UI to react to this.
        await sleep(waitTimeoutAfterTypging);
    }
}
