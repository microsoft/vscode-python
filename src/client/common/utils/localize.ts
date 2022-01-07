// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { FileSystem } from '../platform/fileSystem';
import { getLocalizedString, loadLocalizedStringsUsingNodeFS, shouldLoadUsingNodeFS } from './localizeHelpers';

/* eslint-disable @typescript-eslint/no-namespace, no-shadow */

// External callers of localize use these tables to retrieve localized values.
export namespace Diagnostics {
    export const warnSourceMaps = localize(
        'diagnostics.warnSourceMaps',
        'Source map support is enabled in the Python Extension, this will adversely impact performance of the extension.',
    );
    export const disableSourceMaps = localize('diagnostics.disableSourceMaps', 'Disable Source Map Support');
    export const warnBeforeEnablingSourceMaps = localize(
        'diagnostics.warnBeforeEnablingSourceMaps',
        'Enabling source map support in the Python Extension will adversely impact performance of the extension.',
    );
    export const enableSourceMapsAndReloadVSC = localize(
        'diagnostics.enableSourceMapsAndReloadVSC',
        'Enable and reload Window.',
    );
    export const lsNotSupported = localize(
        'diagnostics.lsNotSupported',
        'Your operating system does not meet the minimum requirements of the Python Language Server. Reverting to the alternative autocompletion provider, Jedi.',
    );
    export const upgradeCodeRunner = localize(
        'diagnostics.upgradeCodeRunner',
        'Please update the Code Runner extension for it to be compatible with the Python extension.',
    );
    export const removedPythonPathFromSettings = localize(
        'diagnostics.removedPythonPathFromSettings',
        'The "python.pythonPath" setting in your settings.json is no longer used by the Python extension. If you want, you can use a new setting called "python.defaultInterpreterPath" instead. Keep in mind that you need to change the value of this setting manually as the Python extension doesn’t modify it when you change interpreters. [Learn more](https://aka.ms/AA7jfor).',
    );
    export const invalidPythonPathInDebuggerSettings = localize(
        'diagnostics.invalidPythonPathInDebuggerSettings',
        'You need to select a Python interpreter before you start debugging.\n\nTip: click on "Select Python Interpreter" in the status bar.',
    );
    export const invalidPythonPathInDebuggerLaunch = localize(
        'diagnostics.invalidPythonPathInDebuggerLaunch',
        'The Python path in your debug configuration is invalid.',
    );
    export const invalidDebuggerTypeDiagnostic = localize(
        'diagnostics.invalidDebuggerTypeDiagnostic',
        'Your launch.json file needs to be updated to change the "pythonExperimental" debug configurations to use the "python" debugger type, otherwise Python debugging may not work. Would you like to automatically update your launch.json file now?',
    );
    export const consoleTypeDiagnostic = localize(
        'diagnostics.consoleTypeDiagnostic',
        'Your launch.json file needs to be updated to change the console type string from "none" to "internalConsole", otherwise Python debugging may not work. Would you like to automatically update your launch.json file now?',
    );
    export const justMyCodeDiagnostic = localize(
        'diagnostics.justMyCodeDiagnostic',
        'Configuration "debugStdLib" in launch.json is no longer supported. It\'s recommended to replace it with "justMyCode", which is the exact opposite of using "debugStdLib". Would you like to automatically update your launch.json file to do that?',
    );
    export const yesUpdateLaunch = localize('diagnostics.yesUpdateLaunch', 'Yes, update launch.json');
    export const invalidTestSettings = localize(
        'diagnostics.invalidTestSettings',
        'Your settings needs to be updated to change the setting "python.unitTest." to "python.testing.", otherwise testing Python code using the extension may not work. Would you like to automatically update your settings now?',
    );
    export const updateSettings = localize('diagnostics.updateSettings', 'Yes, update settings');
    export const checkIsort5UpgradeGuide = localize(
        'diagnostics.checkIsort5UpgradeGuide',
        'We found outdated configuration for sorting imports in this workspace. Check the [isort upgrade guide](https://aka.ms/AA9j5x4) to update your settings.',
    );
    export const pylanceDefaultMessage = localize(
        'diagnostics.pylanceDefaultMessage',
        'The Python extension now includes Pylance to improve completions, code navigation, overall performance and much more! You can learn more about the update and learn how to change your language server [here](https://aka.ms/new-python-bundle).\n\nRead Pylance’s license [here](https://marketplace.visualstudio.com/items/ms-python.vscode-pylance/license).',
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
    export const recommended = localize('Common.recommended', 'Recommended');
    export const clearAll = localize('Common.clearAll', 'Clear all');
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
        'Select the process to attach to',
    );
    export const noProcessSelected = localize('AttachProcess.noProcessSelected', 'No process selected');
    export const refreshList = localize('AttachProcess.refreshList', 'Refresh process list');
}

export namespace Pylance {
    export const remindMeLater = localize('Pylance.remindMeLater', 'Remind me later');

    export const pylanceNotInstalledMessage = localize(
        'Pylance.pylanceNotInstalledMessage',
        'Pylance extension is not installed.',
    );
    export const pylanceInstalledReloadPromptMessage = localize(
        'Pylance.pylanceInstalledReloadPromptMessage',
        'Pylance extension is now installed. Reload window to activate?',
    );

    export const pylanceRevertToJediPrompt = localize(
        'Pylance.pylanceRevertToJediPrompt',
        'The Pylance extension is not installed but the python.languageServer value is set to "Pylance". Would you like to install the Pylance extension to use Pylance, or revert back to Jedi?',
    );
    export const pylanceInstallPylance = localize('Pylance.pylanceInstallPylance', 'Install Pylance');
    export const pylanceRevertToJedi = localize('Pylance.pylanceRevertToJedi', 'Revert to Jedi');
}

export namespace TensorBoard {
    export const enterRemoteUrl = localize('TensorBoard.enterRemoteUrl', 'Enter remote URL');
    export const enterRemoteUrlDetail = localize(
        'TensorBoard.enterRemoteUrlDetail',
        'Enter a URL pointing to a remote directory containing your TensorBoard log files',
    );
    export const useCurrentWorkingDirectoryDetail = localize(
        'TensorBoard.useCurrentWorkingDirectoryDetail',
        'TensorBoard will search for tfevent files in all subdirectories of the current working directory',
    );
    export const useCurrentWorkingDirectory = localize(
        'TensorBoard.useCurrentWorkingDirectory',
        'Use current working directory',
    );
    export const currentDirectory = localize('TensorBoard.currentDirectory', 'Current: {0}');
    export const logDirectoryPrompt = localize(
        'TensorBoard.logDirectoryPrompt',
        'Select a log directory to start TensorBoard with',
    );
    export const progressMessage = localize('TensorBoard.progressMessage', 'Starting TensorBoard session...');
    export const failedToStartSessionError = localize(
        'TensorBoard.failedToStartSessionError',
        'We failed to start a TensorBoard session due to the following error: {0}',
    );
    export const nativeTensorBoardPrompt = localize(
        'TensorBoard.nativeTensorBoardPrompt',
        'VS Code now has integrated TensorBoard support. Would you like to launch TensorBoard?  (Tip: Launch TensorBoard anytime by opening the command palette and searching for "Launch TensorBoard".)',
    );
    export const selectAFolder = localize('TensorBoard.selectAFolder', 'Select a folder');
    export const selectAFolderDetail = localize(
        'TensorBoard.selectAFolderDetail',
        'Select a log directory containing tfevent files',
    );
    export const selectAnotherFolder = localize('TensorBoard.selectAnotherFolder', 'Select another folder');
    export const selectAnotherFolderDetail = localize(
        'TensorBoard.selectAnotherFolderDetail',
        'Use the file explorer to select another folder',
    );
    export const installPrompt = localize(
        'TensorBoard.installPrompt',
        'The package TensorBoard is required to launch a TensorBoard session. Would you like to install it?',
    );
    export const installTensorBoardAndProfilerPluginPrompt = localize(
        'TensorBoard.installTensorBoardAndProfilerPluginPrompt',
        'TensorBoard >= 2.4.1 and the PyTorch Profiler TensorBoard plugin >= 0.2.0 are required. Would you like to install these packages?',
    );
    export const installProfilerPluginPrompt = localize(
        'TensorBoard.installProfilerPluginPrompt',
        'We recommend installing version >= 0.2.0 of the PyTorch Profiler TensorBoard plugin. Would you like to install the package?',
    );
    export const upgradePrompt = localize(
        'TensorBoard.upgradePrompt',
        'Integrated TensorBoard support is only available for TensorBoard >= 2.4.1. Would you like to upgrade your copy of TensorBoard?',
    );
    export const launchNativeTensorBoardSessionCodeLens = localize(
        'TensorBoard.launchNativeTensorBoardSessionCodeLens',
        '▶ Launch TensorBoard Session',
    );
    export const launchNativeTensorBoardSessionCodeAction = localize(
        'TensorBoard.launchNativeTensorBoardSessionCodeAction',
        'Launch TensorBoard session',
    );
    export const missingSourceFile = localize(
        'TensorBoard.missingSourceFile',
        'We could not locate the requested source file on disk. Please manually specify the file.',
    );
    export const selectMissingSourceFile = localize('TensorBoard.selectMissingSourceFile', 'Choose File');
    export const selectMissingSourceFileDescription = localize(
        'TensorBoard.selectMissingSourceFileDescription',
        "The source file's contents may not match the original contents in the trace.",
    );
}

export namespace LanguageService {
    export const virtualWorkspaceStatusItem = {
        detail: localize(
            'LanguageService.virtualWorkspaceStatusItem.detail',
            'Limited IntelliSense supported by Jedi and Pylance',
        ),
    };
    export const statusItem = {
        name: localize('LanguageService.statusItem.name', 'Python IntelliSense Status'),
        text: localize('LanguageService.statusItem.text', 'Partial Mode'),
        detail: localize('LanguageService.statusItem.detail', 'Limited IntelliSense provided by Pylance'),
    };
    export const startingPylance = localize('LanguageService.startingPylance', 'Starting Pylance language server.');
    export const startingJedi = localize('LanguageService.startingJedi', 'Starting Jedi language server.');
    export const startingNone = localize(
        'LanguageService.startingNone',
        'Editor support is inactive since language server is set to None.',
    );
    export const untrustedWorkspaceMessage = localize(
        'LanguageService.untrustedWorkspaceMessage',
        'Only Pylance is supported in untrusted workspaces, setting language server to None.',
    );

    export const reloadAfterLanguageServerChange = localize(
        'LanguageService.reloadAfterLanguageServerChange',
        'Please reload the window switching between language servers.',
    );

    export const lsFailedToStart = localize(
        'LanguageService.lsFailedToStart',
        'We encountered an issue starting the language server. Reverting to Jedi language engine. Check the Python output panel for details.',
    );
    export const lsFailedToDownload = localize(
        'LanguageService.lsFailedToDownload',
        'We encountered an issue downloading the language server. Reverting to Jedi language engine. Check the Python output panel for details.',
    );
    export const lsFailedToExtract = localize(
        'LanguageService.lsFailedToExtract',
        'We encountered an issue extracting the language server. Reverting to Jedi language engine. Check the Python output panel for details.',
    );
    export const downloadFailedOutputMessage = localize(
        'LanguageService.downloadFailedOutputMessage',
        'Language server download failed.',
    );
    export const extractionFailedOutputMessage = localize(
        'LanguageService.extractionFailedOutputMessage',
        'Language server extraction failed.',
    );
    export const extractionCompletedOutputMessage = localize(
        'LanguageService.extractionCompletedOutputMessage',
        'Language server download complete.',
    );
    export const extractionDoneOutputMessage = localize('LanguageService.extractionDoneOutputMessage', 'done.');
    export const reloadVSCodeIfSeachPathHasChanged = localize(
        'LanguageService.reloadVSCodeIfSeachPathHasChanged',
        'Search paths have changed for this Python interpreter. Please reload the extension to ensure that the IntelliSense works correctly.',
    );
}

export namespace Http {
    export const downloadingFile = localize('downloading.file', 'Downloading {0}...');
    export const downloadingFileProgress = localize('downloading.file.progress', '{0}{1} of {2} KB ({3}%)');
}
export namespace Experiments {
    export const inGroup = localize('Experiments.inGroup', "Experiment '{0}' is active");
    export const optedOutOf = localize('Experiments.optedOutOf', "Experiment '{0}' is inactive");
}
export namespace Interpreters {
    export const discovering = localize('Interpreters.DiscoveringInterpreters', 'Discovering Python Interpreters');
    export const refreshing = localize('Interpreters.RefreshingInterpreters', 'Refreshing Python Interpreters');
    export const condaInheritEnvMessage = localize(
        'Interpreters.condaInheritEnvMessage',
        'We noticed you\'re using a conda environment. If you are experiencing issues with this environment in the integrated terminal, we recommend that you let the Python extension change "terminal.integrated.inheritEnv" to false in your user settings.',
    );
    export const environmentPromptMessage = localize(
        'Interpreters.environmentPromptMessage',
        'We noticed a new virtual environment has been created. Do you want to select it for the workspace folder?',
    );
    export const entireWorkspace = localize('Interpreters.entireWorkspace', 'Select at workspace level');
    export const clearAtWorkspace = localize('Interpreters.clearAtWorkspace', 'Clear at workspace level');
    export const selectInterpreterTip = localize(
        'Interpreters.selectInterpreterTip',
        'Tip: you can change the Python interpreter used by the Python extension by clicking on the Python version in the status bar',
    );
    export const pythonInterpreterPath = localize('Interpreters.pythonInterpreterPath', 'Python interpreter path: {0}');
}

export namespace InterpreterQuickPickList {
    export const quickPickListPlaceholder = localize(
        'InterpreterQuickPickList.quickPickListPlaceholder',
        'Current: {0}',
    );
    export const enterPath = {
        label: localize('InterpreterQuickPickList.enterPath.label', 'Enter interpreter path...'),
        placeholder: localize('InterpreterQuickPickList.enterPath.placeholder', 'Enter path to a Python interpreter.'),
    };
    export const defaultInterpreterPath = {
        label: localize(
            'InterpreterQuickPickList.defaultInterpreterPath.label',
            'Use Python from `python.defaultInterpreterPath` setting',
        ),
    };
    export const browsePath = {
        label: localize('InterpreterQuickPickList.browsePath.label', 'Find...'),
        detail: localize(
            'InterpreterQuickPickList.browsePath.detail',
            'Browse your file system to find a Python interpreter.',
        ),
        openButtonLabel: localize('python.command.python.setInterpreter.title', 'Select Interpreter'),
        title: localize('InterpreterQuickPickList.browsePath.title', 'Select Python interpreter'),
    };
    export const refreshInterpreterList = localize(
        'InterpreterQuickPickList.refreshInterpreterList',
        'Refresh Interpreter list',
    );
}
export namespace ExtensionChannels {
    export const yesWeekly = localize('ExtensionChannels.yesWeekly', 'Yes, weekly');
    export const yesDaily = localize('ExtensionChannels.yesDaily', 'Yes, daily');
    export const promptMessage = localize(
        'ExtensionChannels.promptMessage',
        'We noticed you are using Visual Studio Code Insiders. Would you like to use the Insiders build of the Python extension?',
    );
    export const reloadToUseInsidersMessage = localize(
        'ExtensionChannels.reloadToUseInsidersMessage',
        'Please reload Visual Studio Code to use the insiders build of the Python extension.',
    );
    export const downloadCompletedOutputMessage = localize(
        'ExtensionChannels.downloadCompletedOutputMessage',
        'Insiders build download complete.',
    );
    export const startingDownloadOutputMessage = localize(
        'ExtensionChannels.startingDownloadOutputMessage',
        'Starting download for Insiders build.',
    );
    export const downloadingInsidersMessage = localize(
        'ExtensionChannels.downloadingInsidersMessage',
        'Downloading Insiders Extension... ',
    );
    export const installingInsidersMessage = localize(
        'ExtensionChannels.installingInsidersMessage',
        'Installing Insiders build of extension... ',
    );
    export const installingStableMessage = localize(
        'ExtensionChannels.installingStableMessage',
        'Installing Stable build of extension... ',
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
    export const replaceWithSelectedLinter = localize(
        'Linter.replaceWithSelectedLinter',
        "Multiple linters are enabled in settings. Replace with '{0}'?",
    );
    export const selectLinter = localize('Linter.selectLinter', 'Select Linter');
}

export namespace Installer {
    export const noCondaOrPipInstaller = localize(
        'Installer.noCondaOrPipInstaller',
        'There is no Conda or Pip installer available in the selected environment.',
    );
    export const noPipInstaller = localize(
        'Installer.noPipInstaller',
        'There is no Pip installer available in the selected environment.',
    );
    export const searchForHelp = localize('Installer.searchForHelp', 'Search for help');
    export const couldNotInstallLibrary = localize(
        'Installer.couldNotInstallLibrary',
        'Could not install {0}. If pip is not available, please use the package manager of your choice to manually install this library into your Python environment.',
    );
    export const dataScienceInstallPrompt = localize(
        'Installer.dataScienceInstallPrompt',
        'Data Science library {0} is not installed. Install?',
    );
}

export namespace ExtensionSurveyBanner {
    export const bannerMessage = localize(
        'ExtensionSurveyBanner.bannerMessage',
        'Can you please take 2 minutes to tell us how the Python extension is working for you?',
    );
    export const bannerLabelYes = localize('ExtensionSurveyBanner.bannerLabelYes', 'Yes, take survey now');
    export const bannerLabelNo = localize('ExtensionSurveyBanner.bannerLabelNo', 'No, thanks');
    export const maybeLater = localize('ExtensionSurveyBanner.maybeLater', 'Maybe later');
}

export namespace Products {
    export const installingModule = localize('products.installingModule', 'Installing {0}');
    export const formatterNotInstalled = localize(
        'products.formatterNotInstalled',
        'Formatter {0} is not installed. Install?',
    );
    export const useFormatter = localize('products.useFormatter', 'Use {0}');
    export const invalidFormatterPath = localize(
        'products.invalidFormatterPath',
        'Path to the {0} formatter is invalid ({1})',
    );
}
export namespace DebugConfigStrings {
    export const selectConfiguration = {
        title: localize('debug.selectConfigurationTitle'),
        placeholder: localize('debug.selectConfigurationPlaceholder'),
    };
    export const launchJsonCompletions = {
        label: localize('debug.launchJsonConfigurationsCompletionLabel'),
        description: localize('debug.launchJsonConfigurationsCompletionDescription'),
    };

    export namespace file {
        export const snippet = {
            name: localize('python.snippet.launch.standard.label'),
        };

        export const selectConfiguration = {
            label: localize('debug.debugFileConfigurationLabel'),
            description: localize('debug.debugFileConfigurationDescription'),
        };
    }
    export namespace module {
        export const snippet = {
            name: localize('python.snippet.launch.module.label'),
            default: localize('python.snippet.launch.module.default'),
        };

        export const selectConfiguration = {
            label: localize('debug.debugModuleConfigurationLabel'),
            description: localize('debug.debugModuleConfigurationDescription'),
        };
        export const enterModule = {
            title: localize('debug.moduleEnterModuleTitle'),
            prompt: localize('debug.moduleEnterModulePrompt'),
            default: localize('debug.moduleEnterModuleDefault'),
            invalid: localize('debug.moduleEnterModuleInvalidNameError'),
        };
    }
    export namespace attach {
        export const snippet = {
            name: localize('python.snippet.launch.attach.label'),
        };

        export const selectConfiguration = {
            label: localize('debug.remoteAttachConfigurationLabel'),
            description: localize('debug.remoteAttachConfigurationDescription'),
        };
        export const enterRemoteHost = {
            title: localize('debug.attachRemoteHostTitle'),
            prompt: localize('debug.attachRemoteHostPrompt'),
            invalid: localize('debug.attachRemoteHostValidationError'),
        };
        export const enterRemotePort = {
            title: localize('debug.attachRemotePortTitle'),
            prompt: localize('debug.attachRemotePortPrompt'),
            invalid: localize('debug.attachRemotePortValidationError'),
        };
    }
    export namespace attachPid {
        export const snippet = {
            name: localize('python.snippet.launch.attachpid.label'),
        };

        export const selectConfiguration = {
            label: localize('debug.attachPidConfigurationLabel'),
            description: localize('debug.attachPidConfigurationDescription'),
        };
    }
    export namespace django {
        export const snippet = {
            name: localize('python.snippet.launch.django.label'),
        };

        export const selectConfiguration = {
            label: localize('debug.debugDjangoConfigurationLabel'),
            description: localize('debug.debugDjangoConfigurationDescription'),
        };
        export const enterManagePyPath = {
            title: localize('debug.djangoEnterManagePyPathTitle'),
            prompt: localize('debug.djangoEnterManagePyPathPrompt'),
            invalid: localize('debug.djangoEnterManagePyPathInvalidFilePathError'),
        };
    }
    export namespace fastapi {
        export const snippet = {
            name: localize('python.snippet.launch.fastapi.label'),
        };

        export const selectConfiguration = {
            label: localize('debug.debugFastAPIConfigurationLabel'),
            description: localize('debug.debugFastAPIConfigurationDescription'),
        };
        export const enterAppPathOrNamePath = {
            title: localize('debug.fastapiEnterAppPathOrNamePathTitle'),
            prompt: localize('debug.fastapiEnterAppPathOrNamePathPrompt'),
            invalid: localize('debug.fastapiEnterAppPathOrNamePathInvalidNameError'),
        };
    }
    export namespace flask {
        export const snippet = {
            name: localize('python.snippet.launch.flask.label'),
        };

        export const selectConfiguration = {
            label: localize('debug.debugFlaskConfigurationLabel'),
            description: localize('debug.debugFlaskConfigurationDescription'),
        };
        export const enterAppPathOrNamePath = {
            title: localize('debug.flaskEnterAppPathOrNamePathTitle'),
            prompt: localize('debug.flaskEnterAppPathOrNamePathPrompt'),
            invalid: localize('debug.flaskEnterAppPathOrNamePathInvalidNameError'),
        };
    }
    export namespace pyramid {
        export const snippet = {
            name: localize('python.snippet.launch.pyramid.label'),
        };

        export const selectConfiguration = {
            label: localize('debug.debugPyramidConfigurationLabel'),
            description: localize('debug.debugPyramidConfigurationDescription'),
        };
        export const enterDevelopmentIniPath = {
            title: localize('debug.pyramidEnterDevelopmentIniPathTitle'),
            prompt: localize('debug.pyramidEnterDevelopmentIniPathPrompt'),
            invalid: localize('debug.pyramidEnterDevelopmentIniPathInvalidFilePathError'),
        };
    }
}

export namespace Testing {
    export const configureTests = localize('Testing.configureTests', 'Configure Test Framework');
    export const testNotConfigured = localize('Testing.testNotConfigured', 'No test framework configured.');
}

export namespace OutdatedDebugger {
    export const outdatedDebuggerMessage = localize(
        'OutdatedDebugger.updateDebuggerMessage',
        'We noticed you are attaching to ptvsd (Python debugger), which was deprecated on May 1st, 2020. Please switch to [debugpy](https://aka.ms/migrateToDebugpy).',
    );
}

export namespace Python27Support {
    export const jediMessage = localize(
        'Python27Support.jediMessage',
        'IntelliSense with Jedi for Python 2.7 is no longer supported. [Learn more](https://aka.ms/python-27-support).',
    );
}

export namespace SwitchToDefaultLS {
    export const bannerMessage = localize(
        'SwitchToDefaultLS.bannerMessage',
        'The Microsoft Python Language Server has reached end of life. Your language server has been set to the default for Python in VS Code, Pylance.\n\nIf you’d like to change your language server, you can learn about how to do so [here](https://devblogs.microsoft.com/python/python-in-visual-studio-code-may-2021-release/#configuring-your-language-server).\n\nRead Pylance’s license [here](https://marketplace.visualstudio.com/items/ms-python.vscode-pylance/license).',
    );
}

function localize(key: string, defValue?: string) {
    // Return a pointer to function so that we refetch it on each call.
    return (): string => getString(key, defValue);
}

function getString(key: string, defValue?: string) {
    if (shouldLoadUsingNodeFS()) {
        loadLocalizedStringsUsingNodeFS(new FileSystem());
    }
    return getLocalizedString(key, defValue);
}

// Default to loading the current locale
loadLocalizedStringsUsingNodeFS(new FileSystem());
