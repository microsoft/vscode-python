// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { FileSystem } from '../platform/fileSystem';

// External callers of localize use these tables to retrieve localized values.
export namespace Diagnostics {
    export const warnSourceMaps = localize(
        'diagnostics.warnSourceMaps',
        'Source map support is enabled in the Python Extension, this will adversely impact performance of the extension.'
    );
    export const disableSourceMaps = localize('diagnostics.disableSourceMaps', 'Disable Source Map Support');
    export const warnBeforeEnablingSourceMaps = localize(
        'diagnostics.warnBeforeEnablingSourceMaps',
        'Enabling source map support in the Python Extension will adversely impact performance of the extension.'
    );
    export const enableSourceMapsAndReloadVSC = localize(
        'diagnostics.enableSourceMapsAndReloadVSC',
        'Enable and reload Window.'
    );
    export const lsNotSupported = localize(
        'diagnostics.lsNotSupported',
        'Your operating system does not meet the minimum requirements of the Python Language Server. Reverting to the alternative autocompletion provider, Jedi.'
    );
    export const upgradeCodeRunner = localize(
        'diagnostics.upgradeCodeRunner',
        'Please update the Code Runner extension for it to be compatible with the Python extension.'
    );
    export const removedPythonPathFromSettings = localize(
        'diagnostics.removedPythonPathFromSettings',
        'We removed the "python.pythonPath" setting from your settings.json file as the setting is no longer used by the Python extension. You can get the path of your selected interpreter in the Python output channel. [Learn more](https://aka.ms/AA7jfor).'
    );
    export const invalidPythonPathInDebuggerSettings = localize(
        'diagnostics.invalidPythonPathInDebuggerSettings',
        'You need to select a Python interpreter before you start debugging.\n\nTip: click on "Select Python Interpreter" in the status bar.'
    );
    export const invalidPythonPathInDebuggerLaunch = localize(
        'diagnostics.invalidPythonPathInDebuggerLaunch',
        'The Python path in your debug configuration is invalid.'
    );
    export const invalidDebuggerTypeDiagnostic = localize(
        'diagnostics.invalidDebuggerTypeDiagnostic',
        'Your launch.json file needs to be updated to change the "pythonExperimental" debug configurations to use the "python" debugger type, otherwise Python debugging may not work. Would you like to automatically update your launch.json file now?'
    );
    export const consoleTypeDiagnostic = localize(
        'diagnostics.consoleTypeDiagnostic',
        'Your launch.json file needs to be updated to change the console type string from "none" to "internalConsole", otherwise Python debugging may not work. Would you like to automatically update your launch.json file now?'
    );
    export const justMyCodeDiagnostic = localize(
        'diagnostics.justMyCodeDiagnostic',
        'Configuration "debugStdLib" in launch.json is no longer supported. It\'s recommended to replace it with "justMyCode", which is the exact opposite of using "debugStdLib". Would you like to automatically update your launch.json file to do that?'
    );
    export const yesUpdateLaunch = localize('diagnostics.yesUpdateLaunch', 'Yes, update launch.json');
    export const invalidTestSettings = localize(
        'diagnostics.invalidTestSettings',
        'Your settings needs to be updated to change the setting "python.unitTest." to "python.testing.", otherwise testing Python code using the extension may not work. Would you like to automatically update your settings now?'
    );
    export const updateSettings = localize('diagnostics.updateSettings', 'Yes, update settings');
    export const checkIsort5UpgradeGuide = localize(
        'diagnostics.checkIsort5UpgradeGuide',
        'We found outdated configuration for sorting imports in this workspace. Check the [isort upgrade guide](https://aka.ms/AA9j5x4) to update your settings.'
    );
}

export namespace Common {
    export const bannerLabelYes = localize('Common.bannerLabelYes', 'Yes');
    export const bannerLabelNo = localize('Common.bannerLabelNo', 'No');
    export const yesPlease = localize('Common.yesPlease', 'Yes, please');
    export const canceled = localize('Common.canceled', 'Canceled');
    export const cancel = localize('Common.cancel', 'Cancel');
    export const ok = localize('Common.ok', 'Ok');
    export const gotIt = localize('Common.gotIt', 'Got it!');
    export const install = localize('Common.install', 'Install');
    export const loadingExtension = localize('Common.loadingPythonExtension', 'Python extension loading...');
    export const openOutputPanel = localize('Common.openOutputPanel', 'Show output');
    export const noIWillDoItLater = localize('Common.noIWillDoItLater', 'No, I will do it later');
    export const notNow = localize('Common.notNow', 'Not now');
    export const doNotShowAgain = localize('Common.doNotShowAgain', 'Do not show again');
    export const reload = localize('Common.reload', 'Reload');
    export const moreInfo = localize('Common.moreInfo', 'More Info');
    export const learnMore = localize('Common.learnMore', 'Learn more');
    export const and = localize('Common.and', 'and');
    export const reportThisIssue = localize('Common.reportThisIssue', 'Report this issue');
}

export namespace CommonSurvey {
    export const remindMeLaterLabel = localize('CommonSurvey.remindMeLaterLabel', 'Remind me later');
    export const yesLabel = localize('CommonSurvey.yesLabel', 'Yes, take survey now');
    export const noLabel = localize('CommonSurvey.noLabel', 'No, thanks');
}

export namespace AttachProcess {
    export const unsupportedOS = localize('AttachProcess.unsupportedOS', "Operating system '{0}' not supported.");
    export const attachTitle = localize('AttachProcess.attachTitle', 'Attach to process');
    export const selectProcessPlaceholder = localize(
        'AttachProcess.selectProcessPlaceholder',
        'Select the process to attach to'
    );
    export const noProcessSelected = localize('AttachProcess.noProcessSelected', 'No process selected');
    export const refreshList = localize('AttachProcess.refreshList', 'Refresh process list');
}

export namespace Pylance {
    export const proposePylanceMessage = localize(
        'Pylance.proposePylanceMessage',
        'Try out a new faster, feature-rich language server for Python by Microsoft, Pylance! Install the extension now.'
    );
    export const tryItNow = localize('Pylance.tryItNow', 'Try it now');
    export const remindMeLater = localize('Pylance.remindMeLater', 'Remind me later');

    export const installPylanceMessage = localize(
        'Pylance.installPylanceMessage',
        'Pylance extension is not installed. Click Yes to open Pylance installation page.'
    );
    export const pylanceNotInstalledMessage = localize(
        'Pylance.pylanceNotInstalledMessage',
        'Pylance extension is not installed.'
    );
    export const pylanceInstalledReloadPromptMessage = localize(
        'Pylance.pylanceInstalledReloadPromptMessage',
        'Pylance extension is now installed. Reload window to activate?'
    );
}

export namespace Jupyter {
    export const jupyterExtensionRequired = localize(
        'Jupyter.extensionRequired',
        'The Jupyter extension is required to perform that task. Click Yes to open the Jupyter extension installation page.'
    );
}

export namespace LanguageService {
    export const startingJedi = localize('LanguageService.startingJedi', 'Starting Jedi Python language engine.');
    export const startingMicrosoft = localize(
        'LanguageService.startingMicrosoft',
        'Starting Microsoft Python language server.'
    );
    export const startingPylance = localize('LanguageService.startingPylance', 'Starting Pylance language server.');
    export const startingNone = localize(
        'LanguageService.startingNone',
        'Editor support is inactive since language server is set to None.'
    );

    export const reloadAfterLanguageServerChange = localize(
        'LanguageService.reloadAfterLanguageServerChange',
        'Please reload the window switching between language servers.'
    );

    export const lsFailedToStart = localize(
        'LanguageService.lsFailedToStart',
        'We encountered an issue starting the language server. Reverting to Jedi language engine. Check the Python output panel for details.'
    );
    export const lsFailedToDownload = localize(
        'LanguageService.lsFailedToDownload',
        'We encountered an issue downloading the language server. Reverting to Jedi language engine. Check the Python output panel for details.'
    );
    export const lsFailedToExtract = localize(
        'LanguageService.lsFailedToExtract',
        'We encountered an issue extracting the language server. Reverting to Jedi language engine. Check the Python output panel for details.'
    );
    export const downloadFailedOutputMessage = localize(
        'LanguageService.downloadFailedOutputMessage',
        'Language server download failed.'
    );
    export const extractionFailedOutputMessage = localize(
        'LanguageService.extractionFailedOutputMessage',
        'Language server extraction failed.'
    );
    export const extractionCompletedOutputMessage = localize(
        'LanguageService.extractionCompletedOutputMessage',
        'Language server download complete.'
    );
    export const extractionDoneOutputMessage = localize('LanguageService.extractionDoneOutputMessage', 'done.');
    export const reloadVSCodeIfSeachPathHasChanged = localize(
        'LanguageService.reloadVSCodeIfSeachPathHasChanged',
        'Search paths have changed for this Python interpreter. Please reload the extension to ensure that the IntelliSense works correctly.'
    );
}

export namespace Http {
    export const downloadingFile = localize('downloading.file', 'Downloading {0}...');
    export const downloadingFileProgress = localize('downloading.file.progress', '{0}{1} of {2} KB ({3}%)');
}
export namespace Experiments {
    export const inGroup = localize('Experiments.inGroup', "User belongs to experiment group '{0}'");
}
export namespace Interpreters {
    export const loading = localize('Interpreters.LoadingInterpreters', 'Loading Python Interpreters');
    export const refreshing = localize('Interpreters.RefreshingInterpreters', 'Refreshing Python Interpreters');
    export const condaInheritEnvMessage = localize(
        'Interpreters.condaInheritEnvMessage',
        'We noticed you\'re using a conda environment. If you are experiencing issues with this environment in the integrated terminal, we recommend that you let the Python extension change "terminal.integrated.inheritEnv" to false in your user settings.'
    );
    export const unsafeInterpreterMessage = localize(
        'Interpreters.unsafeInterpreterMessage',
        'We found a Python environment in this workspace. Do you want to select it to start up the features in the Python extension? Only accept if you trust this environment.'
    );
    export const environmentPromptMessage = localize(
        'Interpreters.environmentPromptMessage',
        'We noticed a new virtual environment has been created. Do you want to select it for the workspace folder?'
    );
    export const entireWorkspace = localize('Interpreters.entireWorkspace', 'Entire workspace');
    export const selectInterpreterTip = localize(
        'Interpreters.selectInterpreterTip',
        'Tip: you can change the Python interpreter used by the Python extension by clicking on the Python version in the status bar'
    );
    export const pythonInterpreterPath = localize('Interpreters.pythonInterpreterPath', 'Python interpreter path: {0}');
}

export namespace InterpreterQuickPickList {
    export const quickPickListPlaceholder = localize(
        'InterpreterQuickPickList.quickPickListPlaceholder',
        'Current: {0}'
    );
    export const enterPath = {
        detail: localize('InterpreterQuickPickList.enterPath.detail', 'Enter path or find an existing interpreter'),
        label: localize('InterpreterQuickPickList.enterPath.label', 'Enter interpreter path...'),
        placeholder: localize('InterpreterQuickPickList.enterPath.placeholder', 'Enter path to a Python interpreter.')
    };
    export const browsePath = {
        label: localize('InterpreterQuickPickList.browsePath.label', 'Find...'),
        detail: localize(
            'InterpreterQuickPickList.browsePath.detail',
            'Browse your file system to find a Python interpreter.'
        ),
        openButtonLabel: localize('python.command.python.setInterpreter.title', 'Select Interpreter'),
        title: localize('InterpreterQuickPickList.browsePath.title', 'Select Python interpreter')
    };
}
export namespace ExtensionChannels {
    export const yesWeekly = localize('ExtensionChannels.yesWeekly', 'Yes, weekly');
    export const yesDaily = localize('ExtensionChannels.yesDaily', 'Yes, daily');
    export const promptMessage = localize(
        'ExtensionChannels.promptMessage',
        'We noticed you are using Visual Studio Code Insiders. Would you like to use the Insiders build of the Python extension?'
    );
    export const reloadToUseInsidersMessage = localize(
        'ExtensionChannels.reloadToUseInsidersMessage',
        'Please reload Visual Studio Code to use the insiders build of the Python extension.'
    );
    export const downloadCompletedOutputMessage = localize(
        'ExtensionChannels.downloadCompletedOutputMessage',
        'Insiders build download complete.'
    );
    export const startingDownloadOutputMessage = localize(
        'ExtensionChannels.startingDownloadOutputMessage',
        'Starting download for Insiders build.'
    );
    export const downloadingInsidersMessage = localize(
        'ExtensionChannels.downloadingInsidersMessage',
        'Downloading Insiders Extension... '
    );
    export const installingInsidersMessage = localize(
        'ExtensionChannels.installingInsidersMessage',
        'Installing Insiders build of extension... '
    );
    export const installingStableMessage = localize(
        'ExtensionChannels.installingStableMessage',
        'Installing Stable build of extension... '
    );
    export const installationCompleteMessage = localize('ExtensionChannels.installationCompleteMessage', 'complete.');
}
export namespace OutputChannelNames {
    export const languageServer = localize('OutputChannelNames.languageServer', 'Python Language Server');
    export const python = localize('OutputChannelNames.python', 'Python');
    export const pythonTest = localize('OutputChannelNames.pythonTest', 'Python Test Log');
}

export namespace Logging {
    export const currentWorkingDirectory = localize('Logging.CurrentWorkingDirectory', 'cwd:');
}

export namespace Linters {
    export const enableLinter = localize('Linter.enableLinter', 'Enable {0}');
    export const enablePylint = localize(
        'Linter.enablePylint',
        'You have a pylintrc file in your workspace. Do you want to enable pylint?'
    );
    export const replaceWithSelectedLinter = localize(
        'Linter.replaceWithSelectedLinter',
        "Multiple linters are enabled in settings. Replace with '{0}'?"
    );
}

export namespace Installer {
    export const noCondaOrPipInstaller = localize(
        'Installer.noCondaOrPipInstaller',
        'There is no Conda or Pip installer available in the selected environment.'
    );
    export const noPipInstaller = localize(
        'Installer.noPipInstaller',
        'There is no Pip installer available in the selected environment.'
    );
    export const searchForHelp = localize('Installer.searchForHelp', 'Search for help');
    export const couldNotInstallLibrary = localize(
        'Installer.couldNotInstallLibrary',
        'Could not install {0}. If pip is not available, please use the package manager of your choice to manually install this library into your Python environment.'
    );
}

export namespace ExtensionSurveyBanner {
    export const bannerMessage = localize(
        'ExtensionSurveyBanner.bannerMessage',
        'Can you please take 2 minutes to tell us how the Python extension is working for you?'
    );
    export const bannerLabelYes = localize('ExtensionSurveyBanner.bannerLabelYes', 'Yes, take survey now');
    export const bannerLabelNo = localize('ExtensionSurveyBanner.bannerLabelNo', 'No, thanks');
    export const maybeLater = localize('ExtensionSurveyBanner.maybeLater', 'Maybe later');
}

export namespace Products {
    export const installingModule = localize('products.installingModule', 'Installing {0}');
}

export namespace StartPage {
    export const getStarted = localize('StartPage.getStarted', 'Python - Get Started');
    export const pythonExtensionTitle = localize('StartPage.pythonExtensionTitle', 'Python Extension');
    export const createJupyterNotebook = localize('StartPage.createJupyterNotebook', 'Create a Jupyter Notebook');
    export const notebookDescription = localize(
        'StartPage.notebookDescription',
        '- Run "<div class="link italics" role="button" onclick={0}>Create New Blank Jupyter Notebook</div>" in the Command Palette (<div class="italics">Shift + Command + P</div>)<br />- Explore our <div class="link" role="button" onclick={1}>sample notebook</div> to learn about notebook features'
    );
    export const createAPythonFile = localize('StartPage.createAPythonFile', 'Create a Python File');
    export const pythonFileDescription = localize(
        'StartPage.pythonFileDescription',
        '- Create a <div class="link" role="button" onclick={0}>new file</div> with a .py extension'
    );
    export const openInteractiveWindow = localize(
        'StartPage.openInteractiveWindow',
        'Use the Interactive Window to develop Python Scripts'
    );
    export const interactiveWindowDesc = localize(
        'StartPage.interactiveWindowDesc',
        '- You can create cells on a Python file by typing "#%%" <br /> - Use "<div class="italics">Shift + Enter</div> " to run a cell, the output will be shown in the interactive window'
    );

    export const releaseNotes = localize(
        'StartPage.releaseNotes',
        'Take a look at our <a class="link" href={0}>Release Notes</a> to learn more about the latest features.'
    );
    export const tutorialAndDoc = localize(
        'StartPage.tutorialAndDoc',
        'Explore more features in our <a class="link" href={0}>Tutorials</a> or check <a class="link" href={1}>Documentation</a> for tips and troubleshooting.'
    );
    export const dontShowAgain = localize('StartPage.dontShowAgain', "Don't show this page again");
    export const helloWorld = localize('StartPage.helloWorld', 'Hello world');
    // When localizing sampleNotebook, the translated notebook must also be included in
    // pythonFiles\*
    export const sampleNotebook = localize('StartPage.sampleNotebook', 'Notebooks intro');
    export const openFolder = localize('StartPage.openFolder', 'Open a Folder or Workspace');
    export const folderDesc = localize(
        'StartPage.folderDesc',
        '- Open a <div class="link" role="button" onclick={0}>Folder</div><br /> - Open a <div class="link" role="button" onclick={1}>Workspace</div>'
    );
    export const badWebPanelFormatString = localize(
        'StartPage.badWebPanelFormatString',
        '<html><body><h1>{0} is not a valid file name</h1></body></html>'
    );
}

export namespace DebugConfigStrings {
    export const selectConfiguration = {
        title: localize('debug.selectConfigurationTitle'),
        placeholder: localize('debug.selectConfigurationPlaceholder')
    };
    export const launchJsonCompletions = {
        label: localize('debug.launchJsonConfigurationsCompletionLabel'),
        description: localize('debug.launchJsonConfigurationsCompletionDescription')
    };

    export namespace file {
        export const snippet = {
            name: localize('python.snippet.launch.standard.label')
        };
        // tslint:disable-next-line:no-shadowed-variable
        export const selectConfiguration = {
            label: localize('debug.debugFileConfigurationLabel'),
            description: localize('debug.debugFileConfigurationDescription')
        };
    }
    export namespace module {
        export const snippet = {
            name: localize('python.snippet.launch.module.label'),
            default: localize('python.snippet.launch.module.default')
        };
        // tslint:disable-next-line:no-shadowed-variable
        export const selectConfiguration = {
            label: localize('debug.debugModuleConfigurationLabel'),
            description: localize('debug.debugModuleConfigurationDescription')
        };
        export const enterModule = {
            title: localize('debug.moduleEnterModuleTitle'),
            prompt: localize('debug.moduleEnterModulePrompt'),
            default: localize('debug.moduleEnterModuleDefault'),
            invalid: localize('debug.moduleEnterModuleInvalidNameError')
        };
    }
    export namespace attach {
        export const snippet = {
            name: localize('python.snippet.launch.attach.label')
        };
        // tslint:disable-next-line:no-shadowed-variable
        export const selectConfiguration = {
            label: localize('debug.remoteAttachConfigurationLabel'),
            description: localize('debug.remoteAttachConfigurationDescription')
        };
        export const enterRemoteHost = {
            title: localize('debug.attachRemoteHostTitle'),
            prompt: localize('debug.attachRemoteHostPrompt'),
            invalid: localize('debug.attachRemoteHostValidationError')
        };
        export const enterRemotePort = {
            title: localize('debug.attachRemotePortTitle'),
            prompt: localize('debug.attachRemotePortPrompt'),
            invalid: localize('debug.attachRemotePortValidationError')
        };
    }
    export namespace attachPid {
        export const snippet = {
            name: localize('python.snippet.launch.attachpid.label')
        };
        // tslint:disable-next-line:no-shadowed-variable
        export const selectConfiguration = {
            label: localize('debug.attachPidConfigurationLabel'),
            description: localize('debug.attachPidConfigurationDescription')
        };
    }
    export namespace django {
        export const snippet = {
            name: localize('python.snippet.launch.django.label')
        };
        // tslint:disable-next-line:no-shadowed-variable
        export const selectConfiguration = {
            label: localize('debug.debugDjangoConfigurationLabel'),
            description: localize('debug.debugDjangoConfigurationDescription')
        };
        export const enterManagePyPath = {
            title: localize('debug.djangoEnterManagePyPathTitle'),
            prompt: localize('debug.djangoEnterManagePyPathPrompt'),
            invalid: localize('debug.djangoEnterManagePyPathInvalidFilePathError')
        };
    }
    export namespace flask {
        export const snippet = {
            name: localize('python.snippet.launch.flask.label')
        };
        // tslint:disable-next-line:no-shadowed-variable
        export const selectConfiguration = {
            label: localize('debug.debugFlaskConfigurationLabel'),
            description: localize('debug.debugFlaskConfigurationDescription')
        };
        export const enterAppPathOrNamePath = {
            title: localize('debug.flaskEnterAppPathOrNamePathTitle'),
            prompt: localize('debug.flaskEnterAppPathOrNamePathPrompt'),
            invalid: localize('debug.flaskEnterAppPathOrNamePathInvalidNameError')
        };
    }
    export namespace pyramid {
        export const snippet = {
            name: localize('python.snippet.launch.pyramid.label')
        };
        // tslint:disable-next-line:no-shadowed-variable
        export const selectConfiguration = {
            label: localize('debug.debugPyramidConfigurationLabel'),
            description: localize('debug.debugPyramidConfigurationDescription')
        };
        export const enterDevelopmentIniPath = {
            title: localize('debug.pyramidEnterDevelopmentIniPathTitle'),
            prompt: localize('debug.pyramidEnterDevelopmentIniPathPrompt'),
            invalid: localize('debug.pyramidEnterDevelopmentIniPathInvalidFilePathError')
        };
    }
}

export namespace Testing {
    export const testErrorDiagnosticMessage = localize('Testing.testErrorDiagnosticMessage', 'Error');
    export const testFailDiagnosticMessage = localize('Testing.testFailDiagnosticMessage', 'Fail');
    export const testSkippedDiagnosticMessage = localize('Testing.testSkippedDiagnosticMessage', 'Skipped');
    export const configureTests = localize('Testing.configureTests', 'Configure Test Framework');
    export const disableTests = localize('Testing.disableTests', 'Disable Tests');
}

export namespace OutdatedDebugger {
    export const outdatedDebuggerMessage = localize(
        'OutdatedDebugger.updateDebuggerMessage',
        'We noticed you are attaching to ptvsd (Python debugger), which was deprecated on May 1st, 2020. Please switch to [debugpy](https://aka.ms/migrateToDebugpy).'
    );
}

// Skip using vscode-nls and instead just compute our strings based on key values. Key values
// can be loaded out of the nls.<locale>.json files
let loadedCollection: Record<string, string> | undefined;
let defaultCollection: Record<string, string> | undefined;
let askedForCollection: Record<string, string> = {};
let loadedLocale: string;

// This is exported only for testing purposes.
export function _resetCollections() {
    loadedLocale = '';
    loadedCollection = undefined;
    askedForCollection = {};
}

// This is exported only for testing purposes.
export function _getAskedForCollection() {
    return askedForCollection;
}

// Return the effective set of all localization strings, by key.
//
// This should not be used for direct lookup.
export function getCollectionJSON(): string {
    // Load the current collection
    if (!loadedCollection || parseLocale() !== loadedLocale) {
        load();
    }

    // Combine the default and loaded collections
    return JSON.stringify({ ...defaultCollection, ...loadedCollection });
}

// tslint:disable-next-line:no-suspicious-comment
export function localize(key: string, defValue?: string) {
    // Return a pointer to function so that we refetch it on each call.
    return () => {
        return getString(key, defValue);
    };
}

function parseLocale(): string {
    // Attempt to load from the vscode locale. If not there, use english
    const vscodeConfigString = process.env.VSCODE_NLS_CONFIG;
    return vscodeConfigString ? JSON.parse(vscodeConfigString).locale : 'en-us';
}

function getString(key: string, defValue?: string) {
    // Load the current collection
    if (!loadedCollection || parseLocale() !== loadedLocale) {
        load();
    }

    // The default collection (package.nls.json) is the fallback.
    // Note that we are guaranteed the following (during shipping)
    //  1. defaultCollection was initialized by the load() call above
    //  2. defaultCollection has the key (see the "keys exist" test)
    let collection = defaultCollection!;

    // Use the current locale if the key is defined there.
    if (loadedCollection && loadedCollection.hasOwnProperty(key)) {
        collection = loadedCollection;
    }
    let result = collection[key];
    if (!result && defValue) {
        // This can happen during development if you haven't fixed up the nls file yet or
        // if for some reason somebody broke the functional test.
        result = defValue;
    }
    askedForCollection[key] = result;

    return result;
}

function load() {
    const fs = new FileSystem();

    // Figure out our current locale.
    loadedLocale = parseLocale();

    // Find the nls file that matches (if there is one)
    const nlsFile = path.join(EXTENSION_ROOT_DIR, `package.nls.${loadedLocale}.json`);
    if (fs.fileExistsSync(nlsFile)) {
        const contents = fs.readFileSync(nlsFile);
        loadedCollection = JSON.parse(contents);
    } else {
        // If there isn't one, at least remember that we looked so we don't try to load a second time
        loadedCollection = {};
    }

    // Get the default collection if necessary. Strings may be in the default or the locale json
    if (!defaultCollection) {
        const defaultNlsFile = path.join(EXTENSION_ROOT_DIR, 'package.nls.json');
        if (fs.fileExistsSync(defaultNlsFile)) {
            const contents = fs.readFileSync(defaultNlsFile);
            defaultCollection = JSON.parse(contents);
        } else {
            defaultCollection = {};
        }
    }
}

// Default to loading the current locale
load();
