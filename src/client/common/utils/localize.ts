// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as nls from 'vscode-nls';

const localize: nls.LocalizeFunc = nls.loadMessageBundle();

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
    export const removedPythonPathFromSettings = localize(
        'diagnostics.removedPythonPathFromSettings',
        'The "python.pythonPath" setting in your settings.json is no longer used by the Python extension. If you want, you can use a new setting called "python.defaultInterpreterPath" instead. Keep in mind that you need to change the value of this setting manually as the Python extension doesn\'t modify it when you change interpreters. [Learn more](https://aka.ms/AA7jfor).',
    );
    export const invalidPythonPathInDebuggerSettings = localize(
        'diagnostics.invalidPythonPathInDebuggerSettings',
        'You need to select a Python interpreter before you start debugging.\n\nTip: click on "Select Interpreter" in the status bar.',
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
        "The Python extension now includes Pylance to improve completions, code navigation, overall performance and much more! You can learn more about the update and learn how to change your language server [here](https://aka.ms/new-python-bundle).\n\nRead Pylance's license [here](https://marketplace.visualstudio.com/items/ms-python.vscode-pylance/license).",
    );
}

export namespace Common {
    export const bannerLabelYes = localize('Common.bannerLabelYes', 'Yes');
    export const bannerLabelNo = localize('Common.bannerLabelNo', 'No');
    export const yesPlease = localize('Common.yesPlease', 'Yes, please');
    export const canceled = localize('Common.canceled', 'Canceled');
    export const cancel = localize('Common.cancel', 'Cancel');
    export const ok = localize('Common.ok', 'Ok');
    export const error = localize('Common.error', 'Error');
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
    export const alwaysIgnore = localize('Common.alwaysIgnore', 'Always Ignore');
    export const ignore = localize('Common.ignore', 'Ignore');
    export const selectPythonInterpreter = localize('Common.selectPythonInterpreter', 'Select Python Interpreter');
    export const openLaunch = localize('Common.openLaunch', 'Open launch.json');
    export const useCommandPrompt = localize('Common.useCommandPrompt', 'Use Command Prompt');
    export const download = localize('Common.download', 'Download');
    export const showLogs = localize('Common.showLogs', 'Show logs');
}

export namespace CommonSurvey {
    export const remindMeLaterLabel = localize('CommonSurvey.remindMeLaterLabel', 'Remind me later');
    export const yesLabel = localize('CommonSurvey.yesLabel', 'Yes, take survey now');
    export const noLabel = localize('CommonSurvey.noLabel', 'No, thanks');
}

export namespace AttachProcess {
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
    export const logDirectoryPrompt = localize(
        'TensorBoard.logDirectoryPrompt',
        'Select a log directory to start TensorBoard with',
    );
    export const progressMessage = localize('TensorBoard.progressMessage', 'Starting TensorBoard session...');
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
export namespace Interpreters {
    export const installingPython = localize('Interpreters.installingPython', 'Installing Python into Environment...');
    export const discovering = localize('Interpreters.DiscoveringInterpreters', 'Discovering Python Interpreters');
    export const refreshing = localize('Interpreters.RefreshingInterpreters', 'Refreshing Python Interpreters');
    export const condaInheritEnvMessage = localize(
        'Interpreters.condaInheritEnvMessage',
        'We noticed you\'re using a conda environment. If you are experiencing issues with this environment in the integrated terminal, we recommend that you let the Python extension change "terminal.integrated.inheritEnv" to false in your user settings.',
    );
    export const environmentPromptMessage = localize(
        'Interpreters.environmentPromptMessage',
        'We noticed a new environment has been created. Do you want to select it for the workspace folder?',
    );
    export const entireWorkspace = localize('Interpreters.entireWorkspace', 'Select at workspace level');
    export const clearAtWorkspace = localize('Interpreters.clearAtWorkspace', 'Clear at workspace level');
    export const selectInterpreterTip = localize(
        'Interpreters.selectInterpreterTip',
        'Tip: you can change the Python interpreter used by the Python extension by clicking on the Python version in the status bar',
    );
    export const installPythonTerminalMessage = localize(
        'Interpreters.installPythonTerminalMessage',
        '💡 Please try installing the python package using your package manager. Alternatively you can also download it from https://www.python.org/downloads',
    );
}

export namespace InterpreterQuickPickList {
    export const noPythonInstalled = localize(
        'InterpreterQuickPickList.noPythonInstalled',
        'Python is not installed, please download and install it',
    );
    export const clickForInstructions = localize(
        'InterpreterQuickPickList.clickForInstructions',
        'Click for instructions...',
    );
    export const globalGroupName = localize('InterpreterQuickPickList.globalGroupName', 'Global');
    export const workspaceGroupName = localize('InterpreterQuickPickList.workspaceGroupName', 'Workspace');
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
    export const refreshingInterpreterList = localize(
        'InterpreterQuickPickList.refreshingInterpreterList',
        'Refreshing Interpreter list...',
    );
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
export namespace DebugConfigStrings {
    export const selectConfiguration = {
        title: localize('debug.selectConfigurationTitle', 'Select a debug configuration'),
        placeholder: localize('debug.selectConfigurationPlaceholder', 'Debug Configuration'),
    };
    export const launchJsonCompletions = {
        label: localize('debug.launchJsonConfigurationsCompletionLabel', 'Python'),
        description: localize(
            'debug.launchJsonConfigurationsCompletionDescription',
            'Select a Python debug configuration',
        ),
    };

    export namespace file {
        export const snippet = {
            name: localize('python.snippet.launch.standard.label', 'Python: Current File'),
        };

        export const selectConfiguration = {
            label: localize('debug.debugFileConfigurationLabel', 'Python File'),
            description: localize('debug.debugFileConfigurationDescription', 'Debug the currently active Python file'),
        };
    }
    export namespace module {
        export const snippet = {
            name: localize('python.snippet.launch.module.label', 'Python: Module'),
            default: localize('python.snippet.launch.module.default', 'enter-your-module-name'),
        };

        export const selectConfiguration = {
            label: localize('debug.debugModuleConfigurationLabel', 'Module'),
            description: localize(
                'debug.debugModuleConfigurationDescription',
                "Debug a Python module by invoking it with '-m'",
            ),
        };
        export const enterModule = {
            title: localize('debug.moduleEnterModuleTitle', 'Debug Module'),
            prompt: localize('debug.moduleEnterModulePrompt', 'Enter a Python module/package name'),
            default: localize('debug.moduleEnterModuleDefault', 'enter-your-module-name'),
            invalid: localize('debug.moduleEnterModuleInvalidNameError', 'Enter a valid module name'),
        };
    }
    export namespace attach {
        export const snippet = {
            name: localize('python.snippet.launch.attach.label', 'Python: Remote Attach'),
        };

        export const selectConfiguration = {
            label: localize('debug.remoteAttachConfigurationLabel', 'Remote Attach'),
            description: localize('debug.remoteAttachConfigurationDescription', 'Attach to a remote debug server'),
        };
        export const enterRemoteHost = {
            title: localize('debug.attachRemoteHostTitle', 'Remote Debugging'),
            prompt: localize('debug.attachRemoteHostPrompt', 'Enter a valid host name or IP address'),
            invalid: localize('debug.attachRemoteHostValidationError', 'Enter a valid host name or IP address'),
        };
        export const enterRemotePort = {
            title: localize('debug.attachRemotePortTitle', 'Remote Debugging'),
            prompt: localize(
                'debug.attachRemotePortPrompt',
                'Enter the port number that the debug server is listening on',
            ),
            invalid: localize('debug.attachRemotePortValidationError', 'Enter a valid port number'),
        };
    }
    export namespace attachPid {
        export const snippet = {
            name: localize('python.snippet.launch.attachpid.label', 'Python: Attach using Process Id'),
        };

        export const selectConfiguration = {
            label: localize('debug.attachPidConfigurationLabel', 'Attach using Process ID'),
            description: localize('debug.attachPidConfigurationDescription', 'Attach to a local process'),
        };
    }
    export namespace django {
        export const snippet = {
            name: localize('python.snippet.launch.django.label', 'Python: Django'),
        };

        export const selectConfiguration = {
            label: localize('debug.debugDjangoConfigurationLabel', 'Django'),
            description: localize(
                'debug.debugDjangoConfigurationDescription',
                'Launch and debug a Django web application',
            ),
        };
        export const enterManagePyPath = {
            title: localize('debug.djangoEnterManagePyPathTitle', 'Debug Django'),
            prompt: localize(
                'debug.djangoEnterManagePyPathPrompt',
                "Enter the path to manage.py ('${workspaceFolderToken}' points to the root of the current workspace folder)",
            ),
            invalid: localize('debug.djangoEnterManagePyPathInvalidFilePathError', 'Enter a valid Python file path'),
        };
    }
    export namespace fastapi {
        export const snippet = {
            name: localize('python.snippet.launch.fastapi.label', 'Python: FastAPI'),
        };

        export const selectConfiguration = {
            label: localize('debug.debugFastAPIConfigurationLabel', 'FastAPI'),
            description: localize(
                'debug.debugFastAPIConfigurationDescription',
                'Launch and debug a FastAPI web application',
            ),
        };
        export const enterAppPathOrNamePath = {
            title: localize('debug.fastapiEnterAppPathOrNamePathTitle', 'Debug FastAPI'),
            prompt: localize(
                'debug.fastapiEnterAppPathOrNamePathPrompt',
                "Enter the path to the application, e.g. 'main.py' or 'main'",
            ),
            invalid: localize('debug.fastapiEnterAppPathOrNamePathInvalidNameError', 'Enter a valid name'),
        };
    }
    export namespace flask {
        export const snippet = {
            name: localize('python.snippet.launch.flask.label', 'Python: Flask'),
        };

        export const selectConfiguration = {
            label: localize('debug.debugFlaskConfigurationLabel', 'Flask'),
            description: localize(
                'debug.debugFlaskConfigurationDescription',
                'Launch and debug a Flask web application',
            ),
        };
        export const enterAppPathOrNamePath = {
            title: localize('debug.flaskEnterAppPathOrNamePathTitle', 'Debug Flask'),
            prompt: localize('debug.flaskEnterAppPathOrNamePathPrompt', 'Python: Flask'),
            invalid: localize('debug.flaskEnterAppPathOrNamePathInvalidNameError', 'Enter a valid name'),
        };
    }
    export namespace pyramid {
        export const snippet = {
            name: localize('python.snippet.launch.pyramid.label', 'Python: Pyramid Application'),
        };

        export const selectConfiguration = {
            label: localize('debug.debugPyramidConfigurationLabel', 'Pyramid'),
            description: localize(
                'debug.debugPyramidConfigurationDescription',
                'Launch and debug a Pyramid web application',
            ),
        };
        export const enterDevelopmentIniPath = {
            title: localize('debug.pyramidEnterDevelopmentIniPathTitle', 'Debug Pyramid'),
            invalid: localize('debug.pyramidEnterDevelopmentIniPathInvalidFilePathError', 'Enter a valid file path'),
        };
    }
}

export namespace Testing {
    export const configureTests = localize('Testing.configureTests', 'Configure Test Framework');
    export const testNotConfigured = localize('Testing.testNotConfigured', 'No test framework configured.');
    export const cancelUnittestDiscovery = localize(
        'Testing.cancelUnittestDiscovery',
        'Canceled unittest test discovery',
    );
    export const errorUnittestDiscovery = localize('Testing.errorUnittestDiscovery', 'Unittest test discovery error');
    export const seePythonOutput = localize('Testing.seePythonOutput', '(see Output > Python)');
    export const cancelUnittestExecution = localize(
        'Testing.cancelUnittestExecution',
        'Canceled unittest test execution',
    );
    export const errorUnittestExecution = localize('Testing.errorUnittestExecution', 'Unittest test execution error');
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
        "The Microsoft Python Language Server has reached end of life. Your language server has been set to the default for Python in VS Code, Pylance.\n\nIf you'd like to change your language server, you can learn about how to do so [here](https://devblogs.microsoft.com/python/python-in-visual-studio-code-may-2021-release/#configuring-your-language-server).\n\nRead Pylance's license [here](https://marketplace.visualstudio.com/items/ms-python.vscode-pylance/license).",
    );
}

export namespace CreateEnv {
    export const informEnvCreation = localize(
        'createEnv.informEnvCreation',
        'We have selected the following environment:',
    );
    export const statusTitle = localize('createEnv.statusTitle', 'Creating environment');
    export const statusStarting = localize('createEnv.statusStarting', 'Starting...');

    export const hasVirtualEnv = localize('createEnv.hasVirtualEnv', 'Workspace folder contains a virtual environment');

    export const noWorkspace = localize(
        'createEnv.noWorkspace',
        'Please open a directory when creating an environment using venv.',
    );

    export const pickWorkspacePlaceholder = localize(
        'createEnv.workspaceQuickPick.placeholder',
        'Select a workspace to create environment',
    );

    export const providersQuickPickPlaceholder = localize(
        'createEnv.providersQuickPick.placeholder',
        'Select an environment type',
    );

    export namespace Venv {
        export const creating = localize('createEnv.venv.creating', 'Creating venv...');
        export const created = localize('createEnv.venv.created', 'Environment created...');
        export const installingPackages = localize('createEnv.venv.installingPackages', 'Installing packages...');
        export const errorCreatingEnvironment = localize(
            'createEnv.venv.errorCreatingEnvironment',
            'Error while creating virtual environment.',
        );
        export const selectPythonQuickPickTitle = localize(
            'createEnv.venv.basePython.title',
            'Select a python to use for environment creation',
        );
        export const providerDescription = localize(
            'createEnv.venv.description',
            'Creates a `.venv` virtual environment in the current workspace',
        );
        export const error = localize('createEnv.venv.error', 'Creating virtual environment failed with error.');
    }

    export namespace Conda {
        export const condaMissing = localize(
            'createEnv.conda.missing',
            'Please install `conda` to create conda environments.',
        );
        export const created = localize('createEnv.conda.created', 'Environment created...');
        export const installingPackages = localize('createEnv.conda.installingPackages', 'Installing packages...');
        export const errorCreatingEnvironment = localize(
            'createEnv.conda.errorCreatingEnvironment',
            'Error while creating conda environment.',
        );
        export const selectPythonQuickPickPlaceholder = localize(
            'createEnv.conda.pythonSelection.placeholder',
            'Please select the version of Python to install in the environment',
        );
        export const creating = localize('createEnv.conda.creating', 'Creating conda environment...');
        export const providerDescription = localize(
            'createEnv.conda.description',
            'Creates a `.conda` Conda environment in the current workspace',
        );
    }
}
