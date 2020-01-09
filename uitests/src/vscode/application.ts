// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as rimraf from 'rimraf';
import { noop, retryWrapper, sleep } from '../helpers';
import { warn } from '../helpers/logger';
import { getSelector, Selector } from '../selectors';
import { restoreDefaultUserSettings } from '../setup';
import { Driver } from '../setup/driver';
import {
    Channel,
    IApplication,
    IDebugger,
    IDocuments,
    IDriver,
    IInterpreters,
    ILocalization,
    INotifications,
    IPanels,
    IProblems,
    IQuickInput,
    IQuickOpen,
    ISettings,
    ISideBar,
    IStatusBar,
    ITerminal,
    ITestExplorer,
    ITestOptions
} from '../types';
import { Debugger } from './debugger';
import { Documents } from './documents';
import { Interpreters } from './interpreters';
import { Localization } from './localization';
import { Notifications } from './notifications';
import { Panels } from './panels';
import { Problems } from './problems';
import { QuickInput } from './quickInput';
import { QuickOpen } from './quickOpen';
import { Settings } from './settings';
import { SideBar } from './sideBar';
import { StatusBar } from './statusbar';
import { TestExplorer } from './testExplorer';

export class Application extends EventEmitter implements IApplication {
    public readonly quickopen: IQuickOpen;
    public readonly quickinput!: IQuickInput;
    public readonly documents!: IDocuments;
    public readonly debugger!: IDebugger;
    public readonly statusbar!: IStatusBar;
    public readonly problems!: IProblems;
    public readonly settings!: ISettings;
    public readonly terminal!: ITerminal;
    public readonly notifications!: INotifications;
    public readonly interpreters!: IInterpreters;
    public readonly testExplorer!: ITestExplorer;
    public readonly panels!: IPanels;
    public readonly localization!: ILocalization;
    public readonly shideBar!: ISideBar;
    get isAlive(): boolean {
        return this._driver.isAlive;
    }
    get channel(): Channel {
        return this.options.channel;
    }
    get driver(): IDriver {
        return this._driver;
    }
    get workspacePathOrFolder(): string {
        return this.options.workspacePathOrFolder;
    }
    get extensionsPath(): string {
        return this.options.extensionsPath;
    }
    get userDataPath(): string {
        return this.options.userDataPath;
    }
    get userSettingsFilePath(): string {
        return this.options.userSettingsFilePath;
    }
    private readonly _driver: Driver;
    private readonly screenshotCounter = new Map<string, number>();
    constructor(public readonly options: ITestOptions) {
        super();
        this._driver = new Driver(options);
        this.quickopen = new QuickOpen(this);
        this.quickinput = new QuickInput(this);
        this.interpreters = new Interpreters(this);
        this.documents = new Documents(this);
        this.notifications = new Notifications(this);
        this.debugger = new Debugger(this);
        this.testExplorer = new TestExplorer(this);
        this.statusbar = new StatusBar(this);
        this.settings = new Settings(this);
        this.panels = new Panels(this);
        this.problems = new Problems(this);
        this.localization = new Localization(this);
        this.shideBar = new SideBar(this);
        this.registerPostCommandHandlers();
    }
    public async start(emulateFirstTimeLoad: boolean = false): Promise<void> {
        if (emulateFirstTimeLoad) {
            // Also delete the downloaded language server.
            await Promise.all([
                new Promise(resolve => rimraf(this.options.userDataPath, resolve)),
                new Promise(resolve => rimraf(path.join(this.options.extensionsPath, '**', 'languageServer.*'), resolve))
            ]);

            // These must never change (we control the test environment).
            // For now we hard coded the python interpreter used by the extension as well (by setting in user settings).
            await restoreDefaultUserSettings(this.options);
        }
        await this._driver.start();
        this.emit('start', emulateFirstTimeLoad);
    }
    public async exit(): Promise<void> {
        await this._driver.exit();
    }
    public async reload(): Promise<void> {
        await this.exit();
        await this.start();
    }
    public dispose() {
        this.quickopen.dispose();
    }
    public getCSSSelector(selector: Selector): string {
        return getSelector(selector, this.options.channel);
    }
    public async captureScreenshot(name: string = 'screenshot'): Promise<void> {
        // Ensure we don't have any special characters in the file name.
        name = name.replace(/[^a-z0-9\-]/gi, '_');
        if (!this.screenshotCounter.has(this.options.screenshotsPath)) {
            this.screenshotCounter.set(this.options.screenshotsPath, 0);
        }
        const previousCounter = this.screenshotCounter.get(this.options.screenshotsPath)!;
        this.screenshotCounter.set(this.options.screenshotsPath, previousCounter + 1);

        name = `${previousCounter.toString().padStart(3, '0')}.${name}_${new Date()
            .toISOString()
            // Ensure we don't have any special characters in the file name.
            .replace(/[^a-z0-9\-]/gi, '_')}.png`;
        const buffer = await this._driver.captureScreenshot(path.join(this.options.screenshotsPath, name));
        // If we have a hook registered for screenshots, then let them know abou the screenshot captured.
        this.emit('screenshotCatured', buffer);
    }
    /**
     * The command `Python: Show Language Server Output` will be executed programatically by the
     * bootstrap extension.
     * When the bootstrap extension completes execution of the above command a file named `lsoutputdisplayed.log`
     * will be created to notify completion.
     *
     * @returns {Promise<void>}
     * @memberof Application
     */
    public async waitForShowLSOutputPanelCommandExecuted(): Promise<void> {
        const fileToLookFor = path.join(this.options.extensionsPath, 'lsoutputdisplayed.log');
        const errorMessage = `File '${fileToLookFor}' not created by bootstrap extension, after invoking command 'Python: Show Language Server Output'`;
        try {
            const waitForFile = async () => assert.ok(await fs.pathExists(fileToLookFor));
            await retryWrapper({ timeout: 30_000, errorMessage }, waitForFile);
        } catch (ex) {
            warn(errorMessage, ex);
        } finally {
            await fs.unlink(fileToLookFor).catch(noop);
        }
    }
    /**
     * When selecting the command `View: Toggle Maximized Panel` the panels resize.
     * Lets wait for 0.5 seconds for this to happen.
     * It should get resized in a few milli seconds, certainly not seconds.
     *
     * @returns {Promise<void>}
     * @memberof Application
     */
    public async waitForPanelStateToToggle(): Promise<void> {
        await sleep(500);
    }
    /**
     * When selecting commands such as `View Show Test`, the intent is for the test explorer to be displayed.
     * However, this can take a few milliseconds, hence we need to ensure the code waits until it is displayed.
     * Solution - When a command is selected, lets wait immeidately after the command is selected.
     * This is where we'll add such delays (not in the quick open class, as thats not the concern of quick open).
     *
     * @private
     * @memberof Application
     */
    private registerPostCommandHandlers() {
        const postCommandHandlers: Record<string, () => Promise<void>> = {
            'View: Show Test': this.testExplorer.waitUntilOpened.bind(this.testExplorer),
            'View: Show Explorer': this.documents.waitUntilExplorerViewOpened.bind(this.documents),
            // 'Debug: Start Debugging': this.debugger.waitUntilStarted.bind(this.debugger),
            'Debug: Stop Debugging': this.debugger.waitUntilStopped.bind(this.debugger),
            // 'Open New Terminal': this.terminal.waitUntilOpened.bind(this.terminal),
            // 'Python: Create Terminal': this.terminal.waitUntilOpened.bind(this.terminal),
            'View: Focus Problems (Errors, Warnings, Infos)': this.problems.waitUntilOpened.bind(this.problems),
            'Python: Show Language Server Output': this.waitForShowLSOutputPanelCommandExecuted.bind(this),
            'View: Toggle Maximized Panel': this.waitForPanelStateToToggle.bind(this)
        };
        this.quickopen.on('command', async (command, done) => {
            if (postCommandHandlers[command]) {
                await postCommandHandlers[command]();
            }
            done();
        });
    }
}
