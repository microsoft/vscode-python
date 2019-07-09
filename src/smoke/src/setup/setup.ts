// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as cp from 'child_process';
import * as fs from 'fs-extra';
import * as minimist from 'minimist';
import * as path from 'path';
import * as rimraf from 'rimraf';
import * as tmp from 'tmp';
import { Quality } from '../../../../out/smoke/vscode/application';
import { context } from '../application';
import { showCli } from '../cli';
import { extensionRootPath, isCI, vscodeTestPath } from '../constants';
import { getOSType, noop, OSType, unzipFile, unzipVSCode } from '../helpers';
import { downloadFile } from '../helpers/http';
import { getExtensionPath as getBootstrapExtensionPath } from './bootstrap';
import { getVSCodeDirectory, getVSCodeDownloadUrl } from './downloader';

// tslint:disable: no-console

export type TestOptions = {
    quality: Quality;
    waitTime?: number;
    logFile: string;
    vscodePath: string;
    vscodeTestPath: string;
    extensionsPath: string;
    userDataPath: string;
    userSettingsFilePath: string;
    screenshotsPath: string;
    tempPath: string;
    reportsPath: string;
    logsPath: string;
    readonly originalWorkspacePathOrFolder: string;
    workspacePathOrFolder: string;
    verbose: boolean;
    pythonPath: string;
    // python3Path: string;
};

/**
 * Initialize paths where various logs and screenshots related to a test run will be stored.
 * Path provided must be a relative path. As it will be created in the reports directory.
 *
 * @export
 * @param {HookScenarioResult} scenario
 */
export async function initializeBasePaths(baseRelativePath: string) {
    const baseLogsPath = path.join(vscodeTestPath, 'reports');

    context.options.logsPath = path.join(baseLogsPath, baseRelativePath);
    context.options.logFile = path.join(context.options.logsPath, 'smoke.log');
    context.options.screenshotsPath = context.options.logsPath;

    await fs.ensureDir(context.options.logsPath);
    await fs.emptyDir(context.options.logsPath).catch(noop);

    process.env.VSC_PYTHON_LOG_FILE = path.join(context.options.logsPath, 'pvsc.log');
    // Ensure PTVSD logs are in the reports directory,
    // This way they are available for analyzing.
    process.env.PTVSD_LOG_DIR = context.options.logsPath;
}

/**
 * Get options for the UI Tests.
 *
 * @export
 * @returns {TestOptions}
 */
export function getTestOptions(): TestOptions {
    const argv = minimist(process.argv);
    if (argv.help) {
        showCli();
        // tslint:disable-next-line: no-console
        console.log('Current Args');
        // tslint:disable-next-line: no-console
        console.log(argv);
        process.exit(0);
    }
    const quality = argv.channel === 'insider' ? Quality.Insiders : Quality.Stable;
    // Not sure this is used by VS Code (or was this added by us?!).
    const waitTime = parseInt(argv['wait-time'] || '0', 10) || 0;
    const logFile = path.join(vscodeTestPath, 'logs', 'smoke.log');
    // Where is VSC downloaded.
    const vscodePath = getVSCodeDirectory(quality, vscodeTestPath);

    const options = {
        quality, waitTime: waitTime === 0 ? undefined : waitTime,
        logFile,
        vscodePath,
        vscodeTestPath,
        extensionsPath: path.join(vscodeTestPath, 'extensions'),
        userDataPath: path.join(vscodeTestPath, 'user'),
        userSettingsFilePath: path.join(vscodeTestPath, 'user', 'User', 'settings.json'),
        screenshotsPath: path.join(vscodeTestPath, 'screenshots'),
        reportsPath: path.join(vscodeTestPath, 'reports'),
        logsPath: path.join(vscodeTestPath, 'logs'),
        originalWorkspacePathOrFolder: path.join(vscodeTestPath, 'workspace folder'),
        workspacePathOrFolder: path.join(vscodeTestPath, 'workspace folder'),
        tempPath: path.join(vscodeTestPath, 'temp folder'),
        verbose: false, // Verbose logging for VSC smoke test driver.
        pythonPath: argv.pythonPath || cp.execSync('python -c "import sys;print(sys.executable)"').toString().trim()
        // python3Path: argv.python3Path || cp.execSync('python3 -c "import sys;print(sys.executable)"').toString().trim()
    };

    // Set variables for logging to be enabled within extension.
    process.env.TF_BUILD = 'true';

    [
        options.tempPath,
        options.userDataPath,
        options.logsPath,
        options.screenshotsPath,
        options.workspacePathOrFolder
    ].forEach(dir => {
        try {
            fs.emptyDirSync(dir);
        } catch {
            // Ignore.
        }
    });

    [
        options.vscodeTestPath, options.extensionsPath,
        options.userDataPath, options.screenshotsPath,
        options.reportsPath, options.logsPath,
        options.workspacePathOrFolder, options.tempPath,
        path.dirname(options.userSettingsFilePath)
    ].map(dir => {
        try {
            fs.mkdirpSync(dir);
        } catch {
            // Ignore
        }
    });

    return options;
}

export async function initialize(): Promise<TestOptions> {
    const options = getTestOptions();
    await downloadVSCode(options.quality);
    await installExtension(options.extensionsPath, 'ms-python.python', path.join(extensionRootPath, 'ms-python-insiders.vsix'));
    const bootstrapExension = await getBootstrapExtensionPath();
    await installExtension(options.extensionsPath, 'ms-python.bootstrap', bootstrapExension);
    await initializeDefaultUserSettings(options, getExtensionSpecificUserSettingsForAllTests());
    console.log('Initialize completed');
    return options;
}

export async function restoreDefaultUserSettings() {
    await initializeDefaultUserSettings(context.options, getExtensionSpecificUserSettingsForAllTests());
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
export async function initializeDefaultUserSettings(opts: TestOptions, additionalSettings: { [key: string]: {} } = {}) {
    const settingsToAdd: { [key: string]: {} } = {
        'python.pythonPath': opts.pythonPath,
        // We dont need these(avoid VSC from displaying prompts).
        'telemetry.enableTelemetry': false,
        'telemetry.enableCrashReporter': false,
        'debug.showInStatusBar': 'never', // Save some more room in statusbar.
        // We don't want VSC to complete the brackets.
        // When sending text to editors, such as json files, VSC will automatically complete brackets.
        //And that messes up with the text thats being sent to the editor.
        'editor.autoClosingBrackets': 'never',
        ...additionalSettings
    };

    // Maximize the window and reduce font size only on CI.
    if (isCI) {
        // Start VS Code maximized(good for screenshots and the like).
        // At the same time reduce font size, so we can fit more in statusbar.
        // If there isn't much room, then Line/Column info isn't displayed in statusbar.
        // This could also impact Python Interpreter info, hence reduce font size.
        // Also more realestate(capturing logs, etc).
        settingsToAdd['window.zoomLevel'] = -1;
        settingsToAdd['window.newWindowDimensions'] = 'maximized';
    }

    await initializeUserSettings(opts, settingsToAdd);
    console.log('Initialized user settings');
}
async function initializeUserSettings(opts: TestOptions, settings: { [key: string]: {} }) {
    await fs.mkdirp(path.dirname(opts.userSettingsFilePath)).catch(noop);
    return fs.writeFile(opts.userSettingsFilePath, JSON.stringify(settings, undefined, 4), 'utf8');
}
function getVSCodeDestinationDirectory(quality: Quality) {
    return path.join(vscodeTestPath, quality === Quality.Stable ? 'stable' : 'insider');
}

async function hasVSCBeenDownloaded(quality: Quality) {
    const vscodeDir = getVSCodeDestinationDirectory(quality);
    return fs.pathExists(vscodeDir);
}

async function downloadVSCode(quality: Quality) {
    if (await hasVSCBeenDownloaded(quality)) {
        return;
    }
    const targetDir = getVSCodeDestinationDirectory(quality);
    const url = await getVSCodeDownloadUrl(quality);
    const ostype = getOSType();
    const filePostfix = ostype === OSType.Linux ? 'vscode.tar.gz' : 'vscode.zip';
    const targetFile = await new Promise<string>((resolve, reject) => {
        tmp.tmpName({ postfix: filePostfix }, (ex, fileName) => {
            if (ex) {
                return reject(ex);
            }
            resolve(fileName);
        });
    });
    await downloadFile(url, targetFile, `Downloading VS Code ${quality === Quality.Stable ? 'Stable' : 'Insider'}`);
    await unzipVSCode(targetFile, targetDir);
}
async function installExtension(extensionsDir: string, extensionName: string, vsixPath: string) {
    console.info(`Installing extension ${extensionName} from ${vsixPath}`);
    console.info(`Deleting ${path.join(extensionsDir, extensionName)}`);
    await new Promise(resolve => rimraf(path.join(extensionsDir, extensionName), resolve)).catch(noop);
    const tmpDir = await new Promise<string>((resolve, reject) => {
        tmp.dir((ex: Error, dir: string) => {
            if (ex) {
                return reject(ex);
            }
            resolve(dir);
        });
    });
    console.log(`${vsixPath} exists = ${fs.pathExistsSync(vsixPath)}`);
    await unzipFile(vsixPath, tmpDir);
    console.log(`Copy extension ${path.join(tmpDir, 'extension')} into ${path.join(extensionsDir, extensionName)}`);
    await fs.copy(path.join(tmpDir, 'extension'), path.join(extensionsDir, extensionName));
    await new Promise(resolve => rimraf(tmpDir, resolve)).catch(noop);
    console.log(`Completed installing extension ${extensionName}`);
}
