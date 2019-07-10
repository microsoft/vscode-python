// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { HookScenarioResult } from 'cucumber';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Quality } from '../../../out/smoke/vscode/application';
import { ActivityBar } from '../../../out/smoke/vscode/areas/activitybar/activityBar';
import { Explorer } from '../../../out/smoke/vscode/areas/explorer/explorer';
import { Extensions } from '../../../out/smoke/vscode/areas/extensions/extensions';
import { SCM } from '../../../out/smoke/vscode/areas/git/scm';
import { KeybindingsEditor } from '../../../out/smoke/vscode/areas/preferences/keybindings';
import { SettingsEditor } from '../../../out/smoke/vscode/areas/preferences/settings';
import { QuickOpen } from '../../../out/smoke/vscode/areas/quickopen/quickopen';
import { Search } from '../../../out/smoke/vscode/areas/search/search';
import { Terminal } from '../../../out/smoke/vscode/areas/terminal/terminal';
import { Logger as VSCLogger } from '../../../out/smoke/vscode/logger';
import { Code, spawn } from '../../../out/smoke/vscode/vscode/code';
import { Debug } from './areas/debug';
import { Editor } from './areas/editor';
import { Editors } from './areas/editors';
import { Interpreters } from './areas/interpreters';
import { Localization } from './areas/localization';
import { Notifications } from './areas/notifications';
import { Panels } from './areas/panels';
import { Problems } from './areas/problems';
import { QuickInput } from './areas/quickinput';
import { Settings } from './areas/settings';
import { StatusBar } from './areas/statusbar';
import { TestExplorer } from './areas/testExplorer';
// import { extensionRootPath } from './constants';
import { noop } from './helpers';
import { Logger } from './setup/logger';
import { IApplication, IApplicationOptions, IContext, IWorkbench, TestOptions } from './types';

// tslint:disable: max-classes-per-file no-any member-ordering

class Context implements IContext {
    public get app(): IApplication {
        // tslint:disable-next-line: no-use-before-declare
        return Application.instance;
    }
    public get options(): TestOptions {
        return this.app.testOptions;
    }
    public scenario!: HookScenarioResult;
}
export const context: IContext = new Context();

export class Workbench implements IWorkbench {

    public readonly quickopen: QuickOpen;
    public readonly quickinput: QuickInput;
    public readonly editors: Editors;
    public readonly explorer: Explorer;
    public readonly activitybar: ActivityBar;
    public readonly search: Search;
    public readonly extensions: Extensions;
    public readonly editor: Editor;
    public readonly scm: SCM;
    public readonly debug: Debug;
    public readonly statusbar: StatusBar;
    public readonly problems: Problems;
    public readonly settingsEditor: SettingsEditor;
    public readonly keybindingsEditor: KeybindingsEditor;
    public readonly terminal: Terminal;
    public readonly settings: Settings;
    public readonly notifications: Notifications;
    public readonly interpreters: Interpreters;
    public readonly testExplorer: TestExplorer;
    public readonly panels: Panels;
    public readonly localization: Localization;

    constructor(code: Code, userDataPath: string) {
        this.editors = new Editors(code);
        this.quickopen = new QuickOpen(code, this.editors);
        this.quickinput = new QuickInput(code);
        this.explorer = new Explorer(code, this.editors);
        this.activitybar = new ActivityBar(code);
        this.search = new Search(code);
        this.extensions = new Extensions(code);
        this.scm = new SCM(code);
        this.editor = new Editor(code, this.quickopen, this);
        this.debug = new Debug(code, this.quickopen, this.editors, this.editor);
        this.statusbar = new StatusBar(code);
        this.problems = new Problems(code);
        this.settingsEditor = new SettingsEditor(code, userDataPath, this.editors, this.editor, this.quickopen);
        this.keybindingsEditor = new KeybindingsEditor(code);
        this.terminal = new Terminal(code, this.quickopen);
        this.notifications = new Notifications(code, this.quickopen);
        this.settings = new Settings();
        this.interpreters = new Interpreters();
        this.testExplorer = new TestExplorer();
        this.panels = new Panels();
        this.localization = new Localization();
    }
}

/**
 * Test Options (UI Test settings) for VSC launcher.
 *
 * @param {TestOptions} options
 * @returns {IApplicationOptions}
 */
function createOptions(options: TestOptions): IApplicationOptions {
    return {
        quality: options.quality,
        waitTime: options.waitTime || 20,
        workspacePath: options.workspacePathOrFolder,
        codePath: options.vscodePath,
        userDataDir: options.userDataPath,
        extensionsPath: options.extensionsPath,
        logger: new Logger(options.logFile),
        verbose: options.verbose,
        log: 'trace',
        screenshotsPath: options.screenshotsPath,
        tempPath: options.tempPath
    };
}

export class Application implements IApplication {

    private _code: Code | undefined;
    private _workbench!: Workbench;
    private _screenshotHook!: (buffer: Buffer) => void;
    private screenshotCount: number = 0;
    private _attachJsonHook!: (data: {}) => void;
    public static instance: IApplication;
    public readonly options: IApplicationOptions;

    get quality(): Quality {
        return this.options.quality;
    }

    get code(): Code {
        return this._code!;
    }

    get isRunning(): boolean {
        return !!this._code;
    }

    get workbench(): Workbench {
        return this._workbench;
    }

    get logger(): VSCLogger {
        return this.options.logger;
    }

    private _workspacePathOrFolder: string;
    get workspacePathOrFolder(): string {
        return this._workspacePathOrFolder;
    }

    get extensionsPath(): string {
        return this.options.extensionsPath;
    }

    get userDataPath(): string {
        return this.options.userDataDir;
    }

    constructor(public readonly testOptions: TestOptions) {
        Application.instance = this;
        this.options = createOptions(testOptions);
        this._workspacePathOrFolder = this.options.workspacePath;
    }

    public async start(expectWalkthroughPart = true): Promise<any> {
        // tslint:disable-next-line: no-console
        console.log('Start VS Code Application');
        await this._start();
        await this.code.waitForElement('.explorer-folders-view');

        if (expectWalkthroughPart) {
            // tslint:disable-next-line: no-multiline-string
            await this.code.waitForActiveElement(`.editor-instance[id="workbench.editor.walkThroughPart"] > div > div[tabIndex="0"]`);
        }
        // Wait for VSC to start then shut it down.
        // Start to ensure VSC works.
        // Give VSC some time to bootstrap, else it can fall over if we try to shut it down immediately.
        await new Promise(resolve => setTimeout(resolve, 1_000));
    }

    public async restart(options: { workspaceOrFolder?: string; extraArgs?: string[] }): Promise<any> {
        await this.stop();
        await new Promise(c => setTimeout(c, 1000));
        await this._start(options.workspaceOrFolder, options.extraArgs);
    }

    private async _start(workspaceOrFolder = this.workspacePathOrFolder, extraArgs: string[] = []): Promise<any> {
        this._workspacePathOrFolder = workspaceOrFolder;
        await this.startApplication(extraArgs);
        await this.checkWindowReady();
    }

    public async reload(): Promise<any> {
        this.code.reload()
            .catch(noop); // ignore the connection drop errors

        // needs to be enough to propagate the 'Reload Window' command
        await new Promise(c => setTimeout(c, 1500));
        await this.checkWindowReady();
    }

    public async stop(): Promise<any> {
        // tslint:disable-next-line: no-console
        console.log('Stop VS Code Application');
        if (this._code) {
            await this._code.exit()
                .catch(ex => console.error('Failed to exit VS Code', ex));
            try {
                console.log('Dispose socket');
                this._code.dispose();
            } catch (ex) {
                console.error('Failed to dispose VS Code', ex);
            }
            this._code = undefined;
        }
        // tslint:disable-next-line: no-console
        console.log('Stopped VS Code Application');
        // For some reason we need to wait, else starting VSC immediately also causes issues.
        await new Promise(c => setTimeout(c, 1000));
    }

    public async captureScreenshot(name: string): Promise<Buffer | undefined> {
        if (!this._code) {
            return;
        }
        const raw = await this.code.capturePage();
        const buffer = Buffer.from(raw, 'base64');
        // Write to file if path is available (useful for reporting).
        if (this.testOptions.screenshotsPath) {
            // Prefix with number to ensure screenshots are ordered (we know which was captured first).
            const screenshotPath = path.join(this.testOptions.screenshotsPath, `${this.screenshotCount += 1}.${name}.png`);
            if (this.options.log) {
                this.logger.log('*** Screenshot recorded:', screenshotPath);
            }
            await fs.mkdirp(path.dirname(screenshotPath)).catch(noop);
            await fs.writeFile(screenshotPath, buffer);
        }

        (this._screenshotHook || noop)(buffer);
        return buffer;
    }

    public registerScreenshotHook(hook: (buffer: Buffer) => void) {
        this._screenshotHook = hook;
    }
    public registerAttachHook(hook: (data: {}) => void) {
        this._attachJsonHook = hook;
    }
    public attachJson(data: {}) {
        this._attachJsonHook(data);
    }
    private async startApplication(extraArgs: string[] = []): Promise<any> {
        // if (process.platform === 'win32') {
        //     console.log('Updating driver.js on Windows');
        //     // Listen on localhost no `::`, as that won't work on CI (no permissions to listen on all ips).
        //     const quality = this.options.quality === Quality.Stable ? 'stable' : 'insider';
        //     const driverPath = path.join(extensionRootPath, `.vscode test/${quality}/resources/app/out/vs/platform/driver/node/driver.js`);
        //     console.log(`driver.js path ${driverPath}`);
        //     const content = fs.readFileSync(driverPath).toString();
        //     const regex = new RegExp('\\.listen\\((\\w),\\(\\)=>');
        //     fs.writeFileSync(driverPath, content.replace(regex, '.listen({port:$1, host:\'localhost\'},()=>'));
        //     console.log('Updated driver.js on Widows');
        // }

        this._code = await spawn({
            codePath: this.options.codePath,
            workspacePath: this.workspacePathOrFolder,
            userDataDir: this.options.userDataDir,
            extensionsPath: this.options.extensionsPath,
            logger: this.options.logger,
            verbose: this.options.verbose,
            log: this.options.log,
            extraArgs,
            remote: this.options.remote,
            tempPath: this.options.tempPath
        });

        this._workbench = new Workbench(this._code, this.userDataPath);
    }

    private async checkWindowReady(): Promise<any> {
        if (!this.code) {
            console.error('No code instance found');
            return;
        }

        await this.code.waitForWindowIds(ids => ids.length > 0);
        await this.code.waitForElement('.monaco-workbench');

        // wait a bit, since focus might be stolen off widgets
        // as soon as they open (eg quick open)
        await new Promise(c => setTimeout(c, 1000));
    }
}
