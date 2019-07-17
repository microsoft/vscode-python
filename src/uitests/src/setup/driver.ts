// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Browser, ClickOptions, ElementHandle, Keyboard, launch, Mouse, Page, UnwrapElementHandle, WrapElementHandle } from 'puppeteer';
import { URI } from 'vscode-uri';
import { noop, RetryOptions, retryWrapper, sleep } from '../helpers';
import { debug, warn } from '../helpers/logger';
import { getSelector, Selector } from '../selectors';
import { ElementsSelectorPredicate, IDriver, ITestOptions, SelectorRetryOptions, WaitForSelectorOptions, WaitForSelectorOptionsHidden } from '../types';
import { getVSCodeElectronPath } from './downloader';

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
    get keyboard(): Keyboard {
        return this.mainPage.keyboard;
    }
    get mouse(): Mouse {
        return this.mainPage.mouse;
    }
    get isAlive(): boolean {
        return (this.process && !this.process.killed) ? true : false;
    }
    get page(): Page {
        return this.mainPage;
    }
    private process?: ChildProcess;
    private browser!: Browser;
    private pages!: Page[];
    private mainPage!: Page;
    constructor(private readonly options: ITestOptions) { super(); }
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
    public async start(): Promise<void> {
        if (this.process) {
            debug('Killing existing instance before starting VS Code');
            await this.exit().catch(warn);
        }
        const electronPath = getVSCodeElectronPath(this.options.channel, this.options.testPath);
        const args = [
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
            headless: false,
            devtools: false,
            // This must be set to `null`, else VSC UI resizes in a funky way.
            defaultViewport: null,
            // This must be set to ensure puppeteer doesn't send default (additional) args.
            ignoreDefaultArgs: true
        });
        this.process = this.browser.process();
        this.process.on('exit', this.emit.bind(this, 'exit'));

        debug(`Launched with process ${this.process.pid}`);

        this.pages = await this.browser.pages();
        this.mainPage = this.pages[0];
        // We know it will take at least 1 second, so lets wait for 1 second, no point trying before then.
        await sleep(1000);

        // Wait for bootstrap extension to load (when this extension is ready, that means VSC is ready for user interaction).
        // Based on assumption that if extensions have been activated, then VSC is ready for user interaction.
        // Note: This extension loads very quickly (nothing in activation method to slow activation).
        debug('Wait for bootstrap extension to actiavte');
        await this.$(getSelector(Selector.PyBootstrapStatusBar, this.options.channel), { retryTimeout: 15_000, errorMessage: 'Bootstrap extension not activated' });
        debug('VS Code successfully launched');
    }
    public async captureScreenshot(filename: string): Promise<Buffer> {
        return this.mainPage.screenshot({ fullPage: true, path: filename });
    }
    public async exit(): Promise<void> {
        if (!this.process) {
            return;
        }
        this.removeAllListeners();
        debug('Shutting down vscode driver');
        await this.browser.close().catch(warn);
        try {
            if (this.process.connected) {
                // If exiting failed, kill the underlying process.
                process.exit(this.process!.pid);
            }
        } catch {
            noop();
        }
        this.process = undefined;
    }
    public async waitForSelector(selector: string, options?: WaitForSelectorOptions): Promise<ElementHandle>;
    public async waitForSelector(selector: string, options?: WaitForSelectorOptionsHidden): Promise<ElementHandle | undefined>;
    // tslint:disable-next-line: no-any
    public async waitForSelector(selector: string, options?: WaitForSelectorOptions | WaitForSelectorOptionsHidden): Promise<any> {
        if (options && 'hidden' in options && options.hidden === true) {
            // We expect selector to be available.
            return this.page.waitForSelector(selector, { timeout: 3000, ...options })
                .then(ele => ele ? Promise.resolve(ele) : Promise.resolve(undefined))
                .catch(() => undefined);
        }
        // We expect selector to be available.
        return this.page.waitForSelector(selector, options)
            .then(ele => ele ? Promise.resolve(ele) : Promise.reject(new Error(`Element not found for selector '${selector}'.`)));
    }
    // tslint:disable-next-line: no-any
    public async $(selector: string, options?: SelectorRetryOptions): Promise<any> {
        if (!options) {
            return this.mainPage.$(selector)
                .then(ele => ele ? Promise.resolve(ele) : Promise.reject(new Error(`Element not found with selector '${selector}'`)));
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
    // tslint:disable-next-line: prefer-method-signature
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

    public $$eval<R>(
        selector: string,
        pageFunction: (elements: Element[]) => R | Promise<R>
    ): Promise<WrapElementHandle<R>> {
        return this.mainPage.$$eval(selector, pageFunction);
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
        await this.$(selector, { retryTimeout: 500 });
        return this.mainPage.focus(selector);
    }
    public async hover(selector: string): Promise<void> {
        // Ensure element exists before hovering over it.
        await this.$(selector, { retryTimeout: 500 });
        return this.mainPage.hover(selector);
    }
    public async type(selector: string, text: string, options?: { delay: number }): Promise<void> {
        // Ensure element exists before typing into it.
        await this.$(selector, { retryTimeout: 100 });
        // Focus the element before typing into it.
        await this.focus(selector);
        return this.mainPage.type(selector, text, options);
    }
}
