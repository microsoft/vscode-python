// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { ClickOptions, ElementHandle, UnwrapElementHandle, WrapElementHandle } from 'puppeteer-core';
import { localizationKeys as localizationKey } from './constants';
import { Selector } from './selectors';

// tslint:disable: no-any

export type Channel = 'insider' | 'stable';

/**
 * Similar to ConfigurationTarget found in VS Code API.
 *
 * @export
 * @enum {number}
 */
export enum ConfigurationTarget {
    Global = 1,
    Workspace = 2,
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
    /**
     * Path where VSC extensions are located.
     * (typically an `extensions` folder).
     *
     * @type {string}
     * @memberof ITestOptions
     */
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

export type SelectorRetryOptions =
    | {
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
      }
    | {
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
     * Wait for the selector to appear in page.
     * If at the moment of calling the method the selector already exists, the method will return immediately.
     * If the selector doesn't appear after the timeout milliseconds of waiting, the function will throw.
     *
     * options.visible <boolean> wait for element to be present in DOM and to be visible, i.e. to not have display: none or visibility: hidden CSS properties. Defaults to false.
     * options.timeout <number> maximum time to wait for in milliseconds.
     * Defaults to 30000 (30 seconds).
     * Pass 0 to disable timeout.
     * The default value can be changed by using the page.setDefaultTimeout(timeout) method.
     *
     * @param {string} selector A selector of an element to wait for
     * @param {WaitForSelectorOptions} [options] Optional waiting parameters
     * @returns {Promise<ElementHandle>} Promise which resolves when element specified by selector string is added to DOM. Resolves to null if waiting for hidden: true and selector is not found in DOM.
     * @memberof IDriver
     */
    waitForSelector(selector: string, options?: WaitForSelectorOptions): Promise<ElementHandle>;
    /**
     * Wait for the selector to appear in page.
     * If at the moment of calling the method the selector already exists, the method will return immediately.
     * If the selector doesn't appear after the timeout milliseconds of waiting, the function will throw.
     *
     * options.hidden <boolean> wait for element to not be found in the DOM or to be hidden, i.e. have display: none or visibility: hidden CSS properties. Defaults to false.
     * options.timeout <number> maximum time to wait for in milliseconds.
     * Defaults to 30000 (30 seconds).
     * Pass 0 to disable timeout.
     * The default value can be changed by using the page.setDefaultTimeout(timeout) method.
     *
     * @param {string} selector A selector of an element to wait for
     * @param {WaitForSelectorOptions} [options] Optional waiting parameters
     * @returns {Promise<ElementHandle>} Promise which resolves when element specified by selector string is added to DOM. Resolves to null if waiting for hidden: true and selector is not found in DOM.
     * @memberof IDriver
     */
    waitForSelector(selector: string, options?: WaitForSelectorOptionsHidden): Promise<ElementHandle | undefined>;
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
    $eval<R>(selector: string, pageFunction: (element: Element) => R | Promise<R>): Promise<WrapElementHandle<R>>;

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
    $eval<R, X1>(selector: string, pageFunction: (element: Element, x1: UnwrapElementHandle<X1>) => R | Promise<R>, x1: X1): Promise<WrapElementHandle<R>>;

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
    $$eval<R>(selector: string, pageFunction: (elements: Element[]) => R | Promise<R>): Promise<WrapElementHandle<R>>;
    /**
     * This method runs `Array.from(document.querySelectorAll(selector))` within the context and passes it as the
     * first argument to `pageFunction`.
     *
     * If `pageFunction` returns a Promise, then `$$eval` would wait for the promise to resolve and return its value.
     *
     * @param selector A selector to query for
     * @param pageFunction Function to be evaluated in browser context
     * @param x1 First argument to pass to pageFunction
     * @returns Promise which resolves to the return value of pageFunction
     */
    $$eval<R, X1>(selector: string, pageFunction: (elements: Element[], x1: UnwrapElementHandle<X1>) => R | Promise<R>, x1: X1): Promise<WrapElementHandle<R>>;

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
    /**
     * Press a combination of keys.
     *
     * @param {string} keys
     * @param {{ delay: number }} [options]
     * @returns {Promise<void>}
     * @memberof IDriver
     */
    press(keys: string, options?: { delay: number }): Promise<void>;
}
export interface IApplication {
    /**
     * Whether VS Code application is alive.
     *
     * @type {boolean}
     * @memberof IApplication
     */
    readonly isAlive: boolean;
    /**
     * VS Code channel.
     *
     * @type {Channel}
     * @memberof IApplication
     */
    readonly channel: Channel;
    /**
     * UI Driver for VS Code.
     *
     * @type {IDriver}
     * @memberof IApplication
     */
    readonly driver: IDriver;
    /**
     * Test Options.
     *
     * @type {ITestOptions}
     * @memberof IApplication
     */
    readonly options: ITestOptions;
    readonly workspacePathOrFolder: string;
    /**
     * Path to where VSC extension are located.
     * (typically an `extensions` folder).
     *
     * @type {string}
     * @memberof IApplication
     */
    readonly extensionsPath: string;
    readonly userDataPath: string;
    /**
     * Path to the user `settings.json` file.
     *
     * @type {string}
     * @memberof IApplication
     */
    readonly userSettingsFilePath: string;
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
    readonly shideBar: ISideBar;
    /**
     * Starts VS Code.
     *
     * @param {boolean} [emulateFirstTimeLoad] If true, start VS Code as though it was launched for the first time ever.
     * @returns {Promise<any>}
     * @memberof IApplication
     */
    start(emulateFirstTimeLoad?: boolean): Promise<any>;
    /**
     * Event raised when VS Code starts.
     *
     * @param {'start'} event
     * @param {(emulateFirstTimeLoad: boolean) => void} listener
     * @returns {this}
     * @memberof IApplication
     */
    on(event: 'start', listener: (emulateFirstTimeLoad: boolean) => void): this;
    /**
     * Event raised when a screenshot has been captured.
     *
     * @param {'screenshotCatured'} event
     * @param {(data:Buffer) => void} listener
     * @returns {this}
     * @memberof IApplication
     */
    on(event: 'screenshotCatured', listener: (data: Buffer) => void): this;
    /**
     * Reloads VS Code.
     *
     * @returns {Promise<any>}
     * @memberof IApplication
     */
    reload(): Promise<any>;
    /**
     * Exits VS Code.
     *
     * @returns {Promise<any>}
     * @memberof IApplication
     */
    exit(): Promise<any>;
    /**
     * Captures a screenshot with the given name, storing it in the screenshots directory.
     *
     * @param {string} name
     * @returns {Promise<void>}
     * @memberof IApplication
     */
    captureScreenshot(name: string): Promise<void>;
    /**
     * Gets the CSS Selector for various parts of the VS Code UI.
     *
     * @param {Selector} selector
     * @returns {string}
     * @memberof IApplication
     */
    getCSSSelector(selector: Selector): string;
}

export interface IDisposable {
    dispose(): void;
}
/**
 * Manages the Sidebar
 *
 * @export
 * @interface ISidebar
 */
export interface ISideBar {
    isVisible(): Promise<boolean>;
    show(): Promise<void>;
    hide(): Promise<void>;
}
/**
 * Quick Input dropdown UI.
 *
 * @export
 * @interface IQuickInput
 */
export interface IQuickInput {
    /**
     * Select a value in the (currently displayed) quick input dropdown and closes the dropdown.
     *
     * @param {({ value: string } | { index: number })} options
     * @returns {Promise<void>}
     * @memberof IQuickInput
     */
    select(options: { value: string } | { index: number }): Promise<void>;
    // close(): Promise<void>;
    // waitUntilOpened(retryCount?: number): Promise<void>;
    // waitUntilClosed(): Promise<void>;
}
/**
 * Quick Open dropdown UI.
 * This is the dropdown that's used to select files, select commands.
 *
 * @export
 * @interface IQuickOpen
 * @extends {IDisposable}
 */
export interface IQuickOpen extends IDisposable {
    openFile(fileName: string): Promise<void>;
    runCommand(value: string): Promise<void>;
    /**
     * Selects an item from the currently displayed Quick Open UI.
     *
     * @param {string} value
     * @returns {Promise<void>}
     * @memberof IQuickOpen
     */
    select(value: string): Promise<void>;
    /**
     * Displays the Quick Open UI.
     *
     * @returns {Promise<void>}
     * @memberof IQuickOpen
     */
    open(): Promise<void>;
    /**
     * Closes the Quick Open UI.
     *
     * @returns {Promise<void>}
     * @memberof IQuickOpen
     */
    close(): Promise<void>;
    waitUntilOpened(retryCount?: number): Promise<void>;
    waitUntilClosed(): Promise<void>;
    /**
     * Event handler for events raised by the Quick Open UI.
     * When the event is handled, invoke the `done` function (callback).
     *
     * @param {'command'} event
     * @param {(command: string, done: Function) => void} listener
     * @returns {this}
     * @memberof IQuickOpen
     */
    on(event: 'command', listener: (command: string, done: Function) => void): this;
}
export interface IDocuments {
    createNewUntitledFile(): Promise<void>;
    createNewFile(fileName: string, contents: string): Promise<void>;
    waitUntilFileOpened(fileName: string): Promise<void>;
    isExplorerViewOpen(): Promise<boolean>;
    waitUntilExplorerViewOpened(): Promise<void>;
    waitUntilExplorerViewHidden(): Promise<void>;
    refreshExplorer(): Promise<void>;
    gotToPosition(options: { line: number } | { column?: number } | { line: number; column: number }): Promise<void>;
    waitForPosition(options: { line: number }): Promise<void>;
    getCurrentPosition(): Promise<{ line: number; column: number }>;
    getAutoCompletionList(): Promise<string[]>;
    /**
     * Waits until a file editor has focus.
     *
     * @param {string} fileName
     * @returns {Promise<void>}
     * @memberof IDocuments
     */
    waitForEditorFocus(fileName: string): Promise<void>;
    /**
     * Waits until a file is the active editor.
     *
     * @param {string} filename
     * @returns {Promise<void>}
     * @memberof IDocuments
     */
    waitForActiveEditor(filename: string): Promise<void>;
    /**
     * Waits until a file is the active file in editor tabs.
     *
     * @param {string} fileName
     * @param {boolean} [isDirty]
     * @returns {Promise<void>}
     * @memberof IDocuments
     */
    waitForActiveTab(fileName: string, isDirty?: boolean): Promise<void>;
}
export interface IDebugger {
    isDebugViewOpened(): Promise<boolean>;
    waitUntilViewOpened(): Promise<void>;
    waitUntilConsoleOpened(): Promise<void>;
    waitForConfigPicker(): Promise<void>;
    selectConfiguration(configItem: string): Promise<void>;
    waitUntilStarted(): Promise<void>;
    waitUntilStopped(timeout?: number): Promise<void>;
    waitUntilPaused(): Promise<void>;
    setBreakpointOnLine(lineNumber: number): Promise<void>;
}
export interface IStatusBar {
    /**
     * Hides the main python statusbar item (the one with the Interpreter info).
     *
     * @returns {Promise<void>}
     * @memberof IStatusBar
     */
    hidePythonStatusBarItem(): Promise<void>;
    /**
     * Gets the statusbar text from the statusbar entry created by the Python Extension.
     * This generally contains the display name of the Python Interpreter selected.
     *
     * @returns {Promise<string>}
     * @memberof IStatusBar
     */
    getPythonStatusBarText(): Promise<string>;
    /**
     * Waits until the statubar item created by the Python extension is visible.
     *
     * @returns {Promise<void>}
     * @memberof IStatusBar
     */
    waitUntilPythonItemVisible(): Promise<void>;
    /**
     * Waits until the statubar item created by the Bootstrap extension is visible.
     *
     * @returns {Promise<void>}
     * @memberof IStatusBar
     */
    waitUntilBootstrapItemVisible(): Promise<void>;
    /**
     * Waits until a statubar item with the specific text is visible.
     *
     * @param {string} text
     * @param {number} [timeout]
     * @returns {Promise<void>}
     * @memberof IStatusBar
     */
    waitUntilStatusBarItemWithText(text: string, timeout?: number): Promise<void>;
    /**
     * Waits until there is no statubar item with the specific text.
     *
     * @param {string} text
     * @param {number} [timeout]
     * @returns {Promise<void>}
     * @memberof IStatusBar
     */
    waitUntilNoStatusBarItemWithText(text: string, timeout?: number): Promise<void>;
}
export type ProblemSeverity = 'error' | 'warning';
export interface IProblems {
    /**
     * Gets the number of problems in the problems panel.
     *
     * @returns {Promise<number>}
     * @memberof IProblems
     */
    getProblemCount(): Promise<number>;
    waitUntilOpened(): Promise<void>;
    /**
     * Gets the list of file names that have problem entries in the problems panel.
     *
     * @returns {Promise<string[]>}
     * @memberof IProblems
     */
    getProblemFiles(): Promise<string[]>;
    /**
     * Gets the list of problem messages in the problems panel.
     *
     * @returns {Promise<string[]>}
     * @memberof IProblems
     */
    getProblemMessages(): Promise<string[]>;
}
export interface ISettings {
    removeSetting(setting: string, scope: ConfigurationTarget): Promise<void>;
    updateSetting(setting: string, value: string | boolean | number | void, scope: ConfigurationTarget): Promise<void>;
    getSetting<T>(setting: string, scope: ConfigurationTarget): Promise<T | undefined>;
}
export interface ITerminal {
    waitUntilOpened(): Promise<void>;
    runCommand(command: string): Promise<void>;
}
export interface INotifications {
    hasMessages(type?: 'error'): Promise<boolean>;
    getMessages(): Promise<string[]>;
    dismiss(messages: { content: string; buttonText?: string }[], timeout: number): Promise<void>;
}
export interface IInterpreters {
    select(options: { name: string } | { tooltip: string }): Promise<void>;
}

export type TestExplorerToolbarIcon = 'Stop' | 'RunFailedTests';
export type TestingAction = 'run' | 'debug' | 'open';
export type TestExplorerNodeStatus = 'Unknown' | 'Success' | 'Progress' | 'Skip' | 'Ok' | 'Pass' | 'Fail' | 'Error';
export interface ITestExplorer {
    isOpened(): Promise<boolean>;
    isIconVisible(): Promise<boolean>;
    waitUntilOpened(timeout?: number): Promise<void>;
    waitUntilIconVisible(timeout?: number): Promise<void>;
    waitUntilTestsStop(timeout: number): Promise<void>;
    expandNodes(maxNodes?: number): Promise<void>;
    getNodeCount(maxNodes?: number): Promise<number>;
    /**
     * Selects a node in the test explorer tree view, but doesn't click it.
     * I.e. ensure the node has focus.
     *
     * @param {string} label
     * @returns {Promise<void>}
     * @memberof ITestExplorer
     */
    selectNode(label: string): Promise<void>;
    clickNode(label: string): Promise<void>;
    waitUntilToolbarIconVisible(icon: TestExplorerToolbarIcon, timeout?: number): Promise<void>;
    waitUntilToolbarIconHidden(icon: TestExplorerToolbarIcon, timeout?: number): Promise<void>;
    clickToolbarIcon(icon: TestExplorerToolbarIcon): Promise<void>;
    getNodes(): Promise<{ label: string; index: number; status: TestExplorerNodeStatus }[]>;
    getNode(label: string): Promise<{ label: string; index: number; status: TestExplorerNodeStatus }>;
    /**
     * Test explorer treeview nodes have icons associated with them. These can be used to perfom some actions.
     * Use this method to perform an action against a specific node.
     *
     * @param {string} label
     * @param {TestingAction} action
     * @returns {Promise<void>}
     * @memberof ITestExplorer
     */
    selectActionForNode(label: string, action: TestingAction): Promise<void>;
}
export interface IPanels {
    maximize(): Promise<void>;
    minimize(): Promise<void>;
    /**
     * Wait until the content is displayed in the output panel.
     * (will ensure the output panel is maximized before checking - in case the content scrolls.)
     *
     * @param {string} text
     * @param {number} timeout Defaults to 10ms.
     * @returns {Promise<void>}
     * @memberof IPanels
     */
    waitUtilContent(text: string, timeout?: number): Promise<void>;
}
export interface ILocalization {
    /**
     * Gets a localized value given the key (from Python Extension).
     *
     * @param {localizationKey} key
     * @returns {string}
     * @memberof ILocalization
     */
    get(key: localizationKey): string;
}
