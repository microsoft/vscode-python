// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { HookScenarioResult } from 'cucumber';
import { ApplicationOptions, Quality } from '../../../out/smoke/vscode/application';
import { ActivityBar } from '../../../out/smoke/vscode/areas/activitybar/activityBar';
import { Explorer } from '../../../out/smoke/vscode/areas/explorer/explorer';
import { Extensions } from '../../../out/smoke/vscode/areas/extensions/extensions';
import { SCM } from '../../../out/smoke/vscode/areas/git/scm';
import { KeybindingsEditor } from '../../../out/smoke/vscode/areas/preferences/keybindings';
import { SettingsEditor } from '../../../out/smoke/vscode/areas/preferences/settings';
import { Search } from '../../../out/smoke/vscode/areas/search/search';
import { Terminal } from '../../../out/smoke/vscode/areas/terminal/terminal';
import { Logger } from '../../../out/smoke/vscode/logger';
import { Code } from '../../../out/smoke/vscode/vscode/code';
import { Debug } from './areas/debug';
import { Editor } from './areas/editor';
import { Editors } from './areas/editors';
import { Interpreters } from './areas/interpreters';
import { Localization } from './areas/localization';
import { Notifications } from './areas/notifications';
import { Panels } from './areas/panels';
import { Problems } from './areas/problems';
import { QuickInput } from './areas/quickinput';
import { QuickOpen } from './areas/quickopen';
import { Settings } from './areas/settings';
import { StatusBar } from './areas/statusbar';
import { TestExplorer } from './areas/testExplorer';

// tslint:disable: no-any

export type TestOptions = {
    readonly quality: Quality;
    readonly waitTime?: number;
    logFile: string;
    readonly vscodePath: string;
    readonly vscodeTestPath: string;
    readonly extensionsPath: string;
    readonly userDataPath: string;
    readonly userSettingsFilePath: string;
    screenshotsPath: string;
    tempPath: string;
    reportsPath: string;
    logsPath: string;
    readonly originalWorkspacePathOrFolder: string;
    workspacePathOrFolder: string;
    readonly verbose: boolean;
    readonly pythonPath: string;
    // readonly python3Path: string;
};

export interface IContext {
    readonly app: IApplication;
    scenario: HookScenarioResult;
    readonly options: TestOptions;
}

export interface IApplicationOptions extends ApplicationOptions {
}

export interface IApplication {
    readonly quality: Quality;
    readonly code: Code;
    readonly isRunning: boolean;
    readonly workbench: IWorkbench;
    readonly logger: Logger;
    readonly workspacePathOrFolder: string;
    readonly extensionsPath: string;
    readonly userDataPath: string;
    readonly testOptions: TestOptions;
    start(expectWalkthroughPart?: boolean): Promise<any>;
    restart(options: { workspaceOrFolder?: string; extraArgs?: string[] }): Promise<any>;
    reload(): Promise<any>;
    stop(): Promise<any>;
    captureScreenshot(name: string): Promise<Buffer | undefined>;
    registerScreenshotHook(hook: (buffer: Buffer) => void): void;
    registerAttachHook(hook: (data: {}) => void): void;
    attachJson(data: {}): void;

}

export interface IWorkbench {
    readonly quickopen: QuickOpen;
    readonly quickinput: QuickInput;
    readonly editors: Editors;
    readonly explorer: Explorer;
    readonly activitybar: ActivityBar;
    readonly search: Search;
    readonly extensions: Extensions;
    readonly editor: Editor;
    readonly scm: SCM;
    readonly debug: Debug;
    readonly statusbar: StatusBar;
    readonly problems: Problems;
    readonly settingsEditor: SettingsEditor;
    readonly keybindingsEditor: KeybindingsEditor;
    readonly terminal: Terminal;
    readonly settings: Settings;
    readonly notifications: Notifications;
    readonly interpreters: Interpreters;
    readonly testExplorer: TestExplorer;
    readonly panels: Panels;
    readonly localization: Localization;

}
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
