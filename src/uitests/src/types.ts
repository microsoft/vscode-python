// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { HookScenarioResult } from 'cucumber';
import { ClickOptions, ElementHandle, Keyboard, Mouse, Page, UnwrapElementHandle, WrapElementHandle } from 'puppeteer';
import { Selector } from './selectors';

// tslint:disable: no-any

export type Channel = 'insider' | 'stable';

/**
 * The configuration target
 */
export enum ConfigurationTarget {
    /**
     * Global configuration
     */
    Global = 1,

    /**
     * Workspace configuration
     */
    Workspace = 2,

    /**
     * Workspace folder configuration
     */
    WorkspaceFolder = 3
}

export interface ITestOptions {
    /**
     * VS Code channel to be used for testing.
     *
     * @type {Channel}
     * @memberof ITestOptions
     */
    readonly channel: Channel;
    /**
     * Root directory for the UI Tests (typically `.vscode test`).
     *
     * @type {string}
     * @memberof ITestOptions
     */
    readonly testPath: string;
    readonly extensionsPath: string;
    /**
     * Path where VS Code stores user data.
     *
     * @type {string}
     * @memberof ITestOptions
     */
    readonly userDataPath: string;
    readonly userSettingsFilePath: string;
    /**
     * Directory where screenshots are located.
     * This path changes based on the scenario being tested.
     * Basically each test scenario has its own screenshots directory.
     *
     * @type {string}
     * @memberof ITestOptions
     */
    readonly screenshotsPath: string;
    /**
     * Path to temporary directory.
     *
     * @type {string}
     * @memberof ITestOptions
     */
    readonly tempPath: string;
    /**
     * Directory where reports are located.
     * This path changes based on the scenario being tested.
     * Basically each test scenario has its own reports directory.
     *
     * @type {string}
     * @memberof ITestOptions
     */
    readonly reportsPath: string;
    /**
     * Directory where logs are located.
     * This path changes based on the scenario being tested.
     * Basically each test scenario has its own logs directory.
     *
     * @type {string}
     * @memberof ITestOptions
     */
    readonly logsPath: string;
    // readonly originalWorkspacePathOrFolder: string;
    /**
     * Directory for VS Code workspace or the workspace file path (not yet implemented).
     * This path changes based on the scenario being tested.
     * Basically each test scenario has its own workspace directory.
     *
     * @type {string}
     * @memberof ITestOptions
     */
    readonly workspacePathOrFolder: string;
    /**
     * Whether to use verbose logging or not.
     *
     * @type {boolean}
     * @memberof ITestOptions
     */
    readonly verbose: boolean;
    /**
     * Path to python executable that's used by the extension.
     *
     * @type {string}
     * @memberof ITestOptions
     */
    readonly pythonPath: string;
}

export interface ITestContext {
    readonly app: IApplication;
    readonly scenario: HookScenarioResult;
    readonly options: ITestOptions;
    captureScreenshot(): void;
}

export type Timeoutable = {
    /**
     * Maximum navigation time in milliseconds, pass 0 to disable timeout.
     * @default 30000
     */
    timeout?: number;
};
export type WaitForSelectorOptions = Timeoutable & {
    /**
     * Wait for element to be present in DOM and to be visible,
     * i.e. to not have display: none or visibility: hidden CSS properties.
     * @default false
     */
    visible: boolean;
};
export type WaitForSelectorOptionsHidden = Timeoutable & {
    /**
     * Wait for element to not be found in the DOM or to be hidden,
     * i.e. have display: none or visibility: hidden CSS properties.
     * @default false
     */
    hidden: boolean;
};


export type SelectorRetryOptions = {
    /**
     * Time in milli seconds to keep retrying until an element(s) is found.
     *
     * @type {number}
     */
    retryTimeout: number;
    /**
     * Error message to be displayed as part of error raied when there's a timeout.
     *
     * @type {string}
     */
    errorMessage?: string;
    /**
     * If true, then do not log failures.
     * Defaults to true.
     *
     * @type {boolean}
     */
    logFailures?: boolean;
} | {
    /**
     * Max number of times to retry.
     *
     * @type {number}
     */
    retryCount: number;
    /**
     * Error message to be displayed as part of error raied when there's a timeout.
     *
     * @type {string}
     */
    errorMessage?: string;
    /**
     * If true, then do not log failures.
     * Defaults to true.
     *
     * @type {boolean}
     */
    logFailures?: boolean;
};
export type ElementsSelectorPredicate = (elements: ElementHandle[]) => ElementHandle[];
export interface IDriver {
    /**
     * Returns the virtual keyboard.
     *
     * @type {Keyboard}
     * @memberof IDriver
     */
    keyboard: Keyboard;

    /**
     * Gets the virtual mouse.
     *
     * @type {Mouse}
     * @memberof IDriver
     */
    readonly mouse: Mouse;
    readonly page: Page;
    waitForSelector(
        selector: string,
        options?: WaitForSelectorOptions
    ): Promise<ElementHandle>;
    waitForSelector(
        selector: string,
        options?: WaitForSelectorOptionsHidden
    ): Promise<ElementHandle | undefined>;
    /**
     * The method queries frame for the selector.
     * If there's no such element within the frame, the method will throw an error.
     *
     * Use {retryTimeout} to keep retrying until timeout or element is available.
     *
     * @param {string} selector
     * @param {SelectorRetryOptions} [options]
     * @returns {(Promise<ElementHandle>)}
     * @memberof IDriver
     */
    $(selector: string, options?: SelectorRetryOptions): Promise<ElementHandle>;

    /**
     * The method runs document.querySelectorAll within the frame.
     * If no elements match the selector, the return value resolve to [].
     *
     * Use {retryTimeout} to keep retrying until timeout or at least one element is available.
     * (optionally use the predicate to filter out elements).
     *
     * @param {string} selector
     * @returns {Promise<ElementHandle[]>}
     * @memberof IDriver
     */
    $$(selector: string, options?: SelectorRetryOptions & { predicate?: ElementsSelectorPredicate }): Promise<ElementHandle[]>;
    /**
     * This method runs `document.querySelector` within the context and passes it as the first argument to `pageFunction`.
     * If there's no element matching `selector`, the method throws an error.
     *
     * If `pageFunction` returns a Promise, then `$eval` would wait for the promise to resolve and return its value.
     *
     * @param selector A selector to query for
     * @param pageFunction Function to be evaluated in browser context
     * @returns Promise which resolves to the return value of pageFunction
     */
    $eval<R>(
        selector: string,
        pageFunction: (element: Element) => R | Promise<R>
    ): Promise<WrapElementHandle<R>>;

    /**
     * This method runs `document.querySelector` within the context and passes it as the first argument to `pageFunction`.
     * If there's no element matching `selector`, the method throws an error.
     *
     * If `pageFunction` returns a Promise, then `$eval` would wait for the promise to resolve and return its value.
     *
     * @param selector A selector to query for
     * @param pageFunction Function to be evaluated in browser context
     * @param x1 First argument to pass to pageFunction
     * @returns Promise which resolves to the return value of pageFunction
     */
    $eval<R, X1>(
        selector: string,
        pageFunction: (element: Element, x1: UnwrapElementHandle<X1>) => R | Promise<R>,
        x1: X1
    ): Promise<WrapElementHandle<R>>;

    /**
     * This method runs `Array.from(document.querySelectorAll(selector))` within the context and passes it as the
     * first argument to `pageFunction`.
     *
     * If `pageFunction` returns a Promise, then `$$eval` would wait for the promise to resolve and return its value.
     *
     * @param selector A selector to query for
     * @param pageFunction Function to be evaluated in browser context
     * @returns Promise which resolves to the return value of pageFunction
     */
    $$eval<R>(
        selector: string,
        pageFunction: (elements: Element[]) => R | Promise<R>
    ): Promise<WrapElementHandle<R>>;

    /**
     * This method fetches an element with selector, scrolls it into view if needed, and
     * then uses `page.mouse` to click in the center of the element. If there's no element
     * matching selector, the method throws an error.
     *
     * @param {string} selector
     * @param {(ClickOptions & SelectorRetryOptions)} [options]
     * @returns {Promise<void>}
     * @memberof IDriver
     */
    click(selector: string, options?: ClickOptions & SelectorRetryOptions): Promise<void>;

    /**
     * This method fetches an element with selector and focuses it.
     *
     * @param {string} selector
     * @returns {Promise<void>}
     * @memberof IDriver
     */
    focus(selector: string): Promise<void>;

    /**
     * This method fetches an element with `selector`, scrolls it into view if needed,
     * and then uses page.mouse to hover over the center of the element. If there's no
     * element matching `selector`, the method throws an error.
     * @param selector A selector to search for element to hover. If there are multiple elements satisfying the selector, the first will be hovered.
     */
    hover(selector: string): Promise<void>;

    /**
     * Sends a `keydown`, `keypress/input`, and `keyup` event for each character in the text.
     * @param selector A selector of an element to type into. If there are multiple elements satisfying the selector, the first will be used.
     * @param text: A text to type into a focused element.
     * @param options: The typing parameters.
     */
    type(selector: string, text: string, options?: { delay: number }): Promise<void>;
}
export interface IApplication {
    readonly isAlive: boolean;
    readonly channel: Channel;
    readonly driver: IDriver;
    readonly workspacePathOrFolder: string;
    readonly extensionsPath: string;
    readonly userDataPath: string;
    readonly quickopen: IQuickOpen;
    readonly quickinput: IQuickInput;
    readonly documents: IDocuments;
    readonly debugger: IDebugger;
    readonly statusbar: IStatusBar;
    readonly problems: IProblems;
    readonly settings: ISettings;
    readonly terminal: ITerminal;
    readonly notifications: INotifications;
    readonly interpreters: IInterpreters;
    readonly testExplorer: ITestExplorer;
    readonly panels: IPanels;
    readonly localization: ILocalization;
    start(emulateFirstTimeLoad?: boolean): Promise<any>;
    on(event: 'start', listener: (emulateFirstTimeLoad: boolean) => void): this;
    reload(): Promise<any>;
    exit(): Promise<any>;
    captureScreenshot(name: string): Promise<Buffer>;
    getCSSSelector(selector: Selector): string;
}

export interface IOptionalDisposable {
    dispose?(): void;
}
export interface IDisposable {
    dispose(): void;
}
export interface IQuickInput extends IOptionalDisposable {
    select(options: { value: string } | { index: number }): Promise<void>;
    // close(): Promise<void>;
    // waitUntilOpened(retryCount?: number): Promise<void>;
    // waitUntilClosed(): Promise<void>;
}
export interface IQuickOpen extends IDisposable {
    openFile(fileName: string): Promise<void>;
    runCommand(value: string): Promise<void>;
    select(value: string): Promise<void>;
    open(): Promise<void>;
    close(): Promise<void>;
    waitUntilOpened(retryCount?: number): Promise<void>;
    waitUntilClosed(): Promise<void>;
    on(event: 'command', listener: (command: string) => void): this;
}
export interface IDocuments extends IOptionalDisposable {
    // openFile(fileName: string): Promise<void>;
    createNewUntitledFile(): Promise<void>;
    createNewFile(fileName: string, contents: string): Promise<void>;
    waitUntilFileOpened(fileName: string): Promise<void>;
    isExplorerViewOpen(): Promise<boolean>;
    waitUntilExplorerViewOpened(): Promise<void>;
    refreshExplorer(): Promise<void>;
    gotToPosition(options: { line: number } | { column?: number } | { line: number; column: number }): Promise<void>;
    waitForPosition(options: { line: number } | { column?: number } | { line: number; column: number }): Promise<void>;
    getCurrentPosition(): Promise<{ line: number; column: number }>;
    waitForEditorFocus(fileName: string): Promise<void>;
    waitForActiveEditor(filename: string): Promise<void>;
    waitForActiveTab(fileName: string, isDirty?: boolean): Promise<void>;
}
export interface IDebugger extends IOptionalDisposable {
    isDebugViewOpened(): Promise<boolean>;
    waitUntilViewOpened(): Promise<void>;
    waitUntilConsoleOpened(): Promise<void>;
    waitForConfigPicker(): Promise<void>;
    selectConfiguration(configItem: string): Promise<void>;
    waitUntilStarted(): Promise<void>;
    waitUntilStopped(): Promise<void>;
    setBreakpointOnLine(lineNumber: string): Promise<void>;
}
export interface IStatusBar extends IOptionalDisposable {
    getPythonStatusBarText(): Promise<string>;
    waitUntilPythonItemVisible(): Promise<void>;
    waitUntilBootstrapItemVisible(): Promise<void>;
}
export type ProblemSeverity = 'error' | 'warning';
export interface IProblems extends IOptionalDisposable {
    getProblemCount(severity: ProblemSeverity): Promise<number>;
    waitUntilOpened(): Promise<void>;
    getProblems(): Promise<{ message: string; fileName: string; severity: ProblemSeverity }[]>;
}
export interface ISettings extends IOptionalDisposable {
    removeSetting(setting: string, scope: ConfigurationTarget): Promise<void>;
    updateSetting(setting: string, value: string | boolean | number | void, scope: ConfigurationTarget): Promise<void>;
    getSetting<T>(setting: string, scope: ConfigurationTarget): Promise<T | undefined>;
}
export interface ITerminal extends IOptionalDisposable {
    waitUntilOpened(): Promise<void>;
    runCommand(command: string): Promise<void>;
}
export interface INotifications extends IOptionalDisposable {
    hasMessages(): Promise<boolean>;
    getMessages(): Promise<string[]>;
    dismiss(messages: { content: string; buttonText?: string }[], timeout: number): Promise<void>;
}
export interface IInterpreters extends IOptionalDisposable {
    select(options: { name: string } | { tooltip: string }): Promise<void>;
}

export type TestExplorerToolbarIcon = 'Stop' | 'RunFailedTests';
export type TestingAction = 'run' | 'debug' | 'open';
export type TestExplorerNodeStatus = 'Unknown' | 'Success' | 'Progress' | 'Skip' | 'Ok' | 'Pass' | 'Fail' | 'Error';
export interface ITestExplorer extends IOptionalDisposable {
    isOpened(): Promise<boolean>;
    isIconVisible(): Promise<boolean>;
    ensureOpened(): Promise<void>;
    waitUntilOpened(): Promise<void>;
    waitUntilIconVisible(): Promise<void>;
    waitUntilTestsStop(): Promise<void>;
    expandNodes(maxNodes?: number): Promise<void>;
    getNodeCount(maxNodes?: number): Promise<void>;
    selectNode(label: string): Promise<void>;
    waitUntilToolbarIconVisible(icon: TestExplorerToolbarIcon): Promise<void>;
    waitUntilToolbarIconHidden(icon: TestExplorerToolbarIcon): Promise<void>;
    clickToolbarIcon(icon: TestExplorerToolbarIcon): Promise<void>;
    getNodes(): Promise<{ label: string; index: number; status: TestExplorerNodeStatus }>;
    selectActionForNode(label: string, action: TestingAction): Promise<void>;
}
export interface IPanels extends IOptionalDisposable {
    maximize(): Promise<void>;
    minimize(): Promise<void>;
    waitUtilContent(text: string, timeout: number): Promise<void>;
}
export interface ILocalization extends IOptionalDisposable {
    get(key: string): Promise<string>;
}
