// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as cp from 'child_process';
import { HookScenarioResult } from 'cucumber';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as rimraf from 'rimraf';
import * as tmp from 'tmp';
import { isCI } from '../constants';
import { noop, sleep, unzipFile } from '../helpers';
import { debug, info, initialize as initializeLogger, warn } from '../helpers/logger';
import { Selector } from '../selectors';
import { Channel, IApplication, ITestOptions } from '../types';
import { getExtensionPath as getBootstrapExtensionPath } from './bootstrap';

// tslint:disable: no-console

export class TestOptions implements ITestOptions {
    /**
     * Make static, as we might have a couple of runs of same tests.
     * We will use this to ensure we have a unique name (counter increases per process session, hence no conflicts).
     *
     * @private
     * @static
     * @memberof TestOptions
     */
    private static workspaceCounter = 0;
    private _reportsPath?: string;
    private _workspacePathOrFolder!: string;
    get extensionsPath(): string {
        return path.join(this.testPath, 'extensions');
    }
    get userDataPath(): string {
        return path.join(this.testPath, 'user');
    }
    get userSettingsFilePath(): string {
        return path.join(this.userDataPath, 'User', 'settings.json');
    }
    get screenshotsPath(): string {
        return path.join(this._reportsPath || this.testPath, 'screenshots');
    }
    get rootReportsPath(): string {
        return path.join(this.testPath, 'reports');
    }
    get reportsPath(): string {
        return this._reportsPath || this.rootReportsPath;
    }
    get logsPath(): string {
        return path.join(this._reportsPath || this.testPath, 'logs');
    }
    get workspacePathOrFolder(): string {
        return this._workspacePathOrFolder;
    }
    constructor(
        public readonly channel: Channel,
        public readonly testPath: string,
        public readonly tempPath: string,
        public readonly verbose: boolean,
        public readonly pythonPath: string = 'python'
    ) {
        this._workspacePathOrFolder = path.join(this.tempPath, 'workspace folder');
    }
    /**
     * Initialize environment for the tests.
     *
     * @memberof TestOptions
     */
    public async initilize() {
        this._workspacePathOrFolder = this._workspacePathOrFolder || path.join(this.tempPath, `workspace folder${(TestOptions.workspaceCounter += 1)}`);
        await Promise.all([
            new Promise(resolve => rimraf(this.tempPath, resolve)).catch(warn.bind(warn, 'Failed to empty temp dir in updateForScenario')),
            new Promise(resolve => rimraf(this._workspacePathOrFolder, resolve)).catch(warn.bind(warn, 'Failed to create workspace directory'))
        ]);
        await Promise.all([
            fs.ensureDir(this.tempPath),
            fs.ensureDir(this._workspacePathOrFolder),
            fs.ensureDir(this.screenshotsPath),
            fs.ensureDir(this.rootReportsPath),
            fs.ensureDir(this.reportsPath)
        ]);
        // Set variables for logging to be enabled within extension.
        process.env.TF_BUILD = 'true';
        // Where are the Python extension logs written to.
        process.env.VSC_PYTHON_LOG_FILE = path.join(this.logsPath, 'pvsc.log');
        // Ensure PTVSD logs are in the reports directory,
        // This way they are available for analyzing.
        process.env.PTVSD_LOG_DIR = this.logsPath;
        // Disable process logging (src/client/common/process/logger.ts).
        // Minimal logging in output channel (cuz we look for specific text in output channel).
        process.env.UITEST_DISABLE_PROCESS_LOGGING = 'true';
        // Disable Insiders in UI Tests for now.
        process.env.UITEST_DISABLE_INSIDERS = 'true';
    }
    /**
     * Update the options for the tests based on the provided scenario.
     * Initialize paths where various logs and screenshots related to a test run will be stored.
     * Path provided must be a relative path. As it will be created in the reports directory.
     *
     * @param {HookScenarioResult} scenario
     * @returns
     * @memberof TestOptions
     */
    public async updateForScenario(scenario: HookScenarioResult) {
        const location = scenario.pickle.locations[0].line;
        this._reportsPath = path.join(this.rootReportsPath, `${scenario.pickle.name}:${location}:_${TestOptions.workspaceCounter}`.replace(/[^a-z0-9\-]/gi, '_'));
        this._workspacePathOrFolder = path.join(this.tempPath, `workspace folder${(TestOptions.workspaceCounter += 1)}`);
        await this.initilize();
    }
    public udpateWorkspaceFolder(workspaceFolder: string) {
        this._workspacePathOrFolder = workspaceFolder;
    }
}

/**
 * Get options for the UI Tests.
 *
 * @export
 * @returns {TestOptions}
 */
export function getTestOptions(channel: Channel, testDir: string, pythonPath: string = 'python', verboseLogging: boolean = false): ITestOptions {
    pythonPath =
        pythonPath ||
        cp
            .execSync('python -c "import sys;print(sys.executable)"')
            .toString()
            .trim();
    const options = new TestOptions(channel, testDir, path.join(testDir, 'temp folder'), verboseLogging, pythonPath);
    [options.tempPath, options.userDataPath, options.logsPath, options.screenshotsPath, options.workspacePathOrFolder].forEach(dir => {
        try {
            rimraf.sync(dir);
        } catch {
            // Ignore.
        }
    });

    [
        options.testPath,
        options.extensionsPath,
        options.userDataPath,
        options.screenshotsPath,
        options.reportsPath,
        options.logsPath,
        options.workspacePathOrFolder,
        options.tempPath,
        path.dirname(options.userSettingsFilePath)
    ].map(dir => {
        try {
            fs.ensureDirSync(dir);
        } catch {
            // Ignore
        }
    });

    initializeLogger(verboseLogging, path.join(options.logsPath, 'uitests.log'));

    return options;
}

export async function installExtensions(channel: Channel, testDir: string, vsixPath: string): Promise<void> {
    const options = getTestOptions(channel, testDir);
    await installExtension(options.extensionsPath, 'ms-python.python', vsixPath);
    const bootstrapExension = await getBootstrapExtensionPath();
    await installExtension(options.extensionsPath, 'ms-python.bootstrap', bootstrapExension);
    info('Installed extensions');
}

export async function restoreDefaultUserSettings(options: ITestOptions) {
    await initializeDefaultUserSettings(options, getExtensionSpecificUserSettingsForAllTests());
}

function getExtensionSpecificUserSettingsForAllTests(): { [key: string]: {} } {
    return {
        // Log everything in LS server, to ensure they are captured in reports.
        // Found under.vscode test/reports/user/logs/xxx/exthostx/output_logging_xxx/x-Python.log
        // These are logs created by VSC.
        // Enabling this makes it difficult to look for text in the panel(there's too much content).
        // "python.analysis.logLevel": "Trace",
        'python.venvFolders': ['envs', '.pyenv', '.direnv', '.local/share/virtualenvs'],
        // Disable pylint(we don't want this message)
        'python.linting.pylintEnabled': false
    };
}
async function initializeDefaultUserSettings(opts: ITestOptions, additionalSettings: { [key: string]: {} } = {}) {
    const settingsToAdd: { [key: string]: {} } = {
        'python.pythonPath': opts.pythonPath,
        // We dont need these(avoid VSC from displaying prompts).
        'telemetry.enableTelemetry': false,
        // We don't want extensions getting updated/installed automatically.
        'extensions.autoUpdate': false,
        'telemetry.enableCrashReporter': false,
        // Download latest (upon first load), do not update while tests are running.
        'python.autoUpdateLanguageServer': false,
        // Minimal logging in output channel (cuz we look for specific text in output channel).
        'python.analysis.logLevel': 'Error',
        // Disable experiments, we don't want unexpected behaviors.
        // Experiments result in dynamic (chance) runtime behaviors.
        'python.experiments.enabled': false,
        'debug.showInStatusBar': 'never', // Save some more room in statusbar.
        // We don't want VSC to complete the brackets.
        // When sending text to editors, such as json files, VSC will automatically complete brackets.
        //And that messes up with the text thats being sent to the editor.
        'editor.autoClosingBrackets': 'never',
        'editor.autoClosingOvertype': 'never',
        'editor.autoClosingQuotes': 'never',
        // We need more realestate.
        'editor.minimap.enabled': false,
        // We don't want any surprises.
        'extensions.autoCheckUpdates': false,
        'update.mode': 'none',
        // Save realestate by hiding the branch info in statubar (we don't need this).
        // On CI resolution is fairly low, hence realestate in statubar is limited.
        // E.g. getting line & column numbers sometimes are not displayed.
        // Solution - hide what we don't need.
        'git.enabled': false,
        ...additionalSettings
    };

    // See logic in here https://github.com/Microsoft/vscode-python/blob/master/src/client/common/insidersBuild/insidersExtensionService.ts
    if (opts.channel === 'insider') {
        // We don't want insiders getting installed (at all).
        // That'll break everything.
        settingsToAdd['python.insidersChannel'] = 'off';
    }

    // Maximize the window and reduce font size only on CI.
    if (isCI) {
        // Start VS Code maximized(good for screenshots and the like).
        // Also more realestate(capturing logs, etc).
        settingsToAdd['window.newWindowDimensions'] = 'maximized';
    }

    await initializeUserSettings(opts, settingsToAdd);
}

export async function waitForPythonExtensionToActivate(timeout: number, app: IApplication) {
    debug('Start activating Python Extension');
    await app.quickopen.runCommand('Activate Python Extension');
    // We know it will take at least 1 second, so lets wait for 1 second, no point trying before then.
    await sleep(1000);
    const selector = app.getCSSSelector(Selector.PyBootstrapActivatedStatusBar);
    await app.driver.waitForSelector(selector, { timeout, visible: true });
    debug('Python Extension activation completed');
}

async function initializeUserSettings(opts: ITestOptions, settings: { [key: string]: {} }) {
    debug(`initializeUserSettings ${opts.userSettingsFilePath} with ${JSON.stringify(settings)}`);
    await fs.mkdirp(path.dirname(opts.userSettingsFilePath)).catch(noop);
    return fs.writeFile(opts.userSettingsFilePath, JSON.stringify(settings, undefined, 4), 'utf8');
}

async function installExtension(extensionsDir: string, extensionName: string, vsixPath: string) {
    await new Promise(resolve => rimraf(path.join(extensionsDir, extensionName), resolve)).catch(noop);
    const tmpDir = await new Promise<string>((resolve, reject) => {
        tmp.dir((ex: Error, dir: string) => {
            if (ex) {
                return reject(ex);
            }
            resolve(dir);
        });
    });
    await unzipFile(vsixPath, tmpDir);
    await fs.copy(path.join(tmpDir, 'extension'), path.join(extensionsDir, extensionName));
    await new Promise(resolve => rimraf(tmpDir, resolve)).catch(noop);
}
