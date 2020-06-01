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
    export const removePythonPathSettingsJson = localize(
        'diagnostics.removePythonPathSettingsJson',
        'The setting "python.pythonPath" defined in your settings.json is now deprecated. Do you want us to delete it from your settings.json only? [Learn more](https://aka.ms/AA7jfor).'
    );
    export const removePythonPathCodeWorkspace = localize(
        'diagnostics.removePythonPathCodeWorkspace',
        'The setting "python.pythonPath" defined in your workspace settings is now deprecated. Do you want us to delete it from your .code-workspace file only? [Learn more](https://aka.ms/AA7jfor).'
    );
    export const removePythonPathCodeWorkspaceAndSettingsJson = localize(
        'diagnostics.removePythonPathCodeWorkspaceAndSettingsJson',
        'The setting "python.pythonPath" defined in your workspace settings is now deprecated. Do you want us to delete it from your .code-workspace file and settings.json? [Learn more](https://aka.ms/AA7jfor).'
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
    export const processId = localize(
        'diagnostics.processId',
        'Attaching the debugger to a local process is an experimental feature. It will be available to all users soon.'
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

export namespace LanguageService {
    export const bannerMessage = localize(
        'LanguageService.bannerMessage',
        'Can you please take 2 minutes to tell us how the Python Language Server is working for you?'
    );
    export const bannerLabelYes = localize('LanguageService.bannerLabelYes', 'Yes, take survey now');
    export const bannerLabelNo = localize('LanguageService.bannerLabelNo', 'No, thanks');
    export const lsFailedToStart = localize(
        'LanguageService.lsFailedToStart',
        'We encountered an issue starting the Language Server. Reverting to the alternative, Jedi. Check the Python output panel for details.'
    );
    export const lsFailedToDownload = localize(
        'LanguageService.lsFailedToDownload',
        'We encountered an issue downloading the Language Server. Reverting to the alternative, Jedi. Check the Python output panel for details.'
    );
    export const lsFailedToExtract = localize(
        'LanguageService.lsFailedToExtract',
        'We encountered an issue extracting the Language Server. Reverting to the alternative, Jedi. Check the Python output panel for details.'
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
        openButtonLabel: localize('python.command.python.setInterpreter.title', 'Select Interpreter')
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
    export const jupyter = localize('OutputChannelNames.jupyter', 'Jupyter');
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

export namespace InteractiveShiftEnterBanner {
    export const bannerMessage = localize(
        'InteractiveShiftEnterBanner.bannerMessage',
        'Would you like shift-enter to send code to the new Interactive Window experience?'
    );
}

export namespace DataScienceSurveyBanner {
    export const bannerMessage = localize(
        'DataScienceSurveyBanner.bannerMessage',
        'Can you please take 2 minutes to tell us how the Python Data Science features are working for you?'
    );
    export const bannerLabelYes = localize('DataScienceSurveyBanner.bannerLabelYes', 'Yes, take survey now');
    export const bannerLabelNo = localize('DataScienceSurveyBanner.bannerLabelNo', 'No, thanks');
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
}

export namespace ExtensionSurveyBanner {
    export const bannerMessage = localize(
        'ExtensionSurveyBanner.bannerMessage',
        'Can you please take 2 minutes to tell us how the Python extension is working for you?'
    );
    export const maybeLater = localize('ExtensionSurveyBanner.maybeLater', 'Maybe later');
}

export namespace Products {
    export const installingModule = localize('products.installingModule', 'Installing {0}');
}

export namespace DataScience {
    export const historyTitle = localize('DataScience.historyTitle', 'Python Interactive');
    export const dataExplorerTitle = localize('DataScience.dataExplorerTitle', 'Data Viewer');
    export const badWebPanelFormatString = localize(
        'DataScience.badWebPanelFormatString',
        '<html><body><h1>{0} is not a valid file name</h1></body></html>'
    );
    export const sessionDisposed = localize(
        'DataScience.sessionDisposed',
        'Cannot execute code, session has been disposed.'
    );
    export const passwordFailure = localize(
        'DataScience.passwordFailure',
        'Failed to connect to password protected server. Check that password is correct.'
    );
    export const rawKernelProcessNotStarted = localize(
        'DataScience.rawKernelProcessNotStarted',
        'Raw kernel process was not able to start.'
    );
    export const rawKernelProcessExitBeforeConnect = localize(
        'DataScience.rawKernelProcessExitBeforeConnect',
        'Raw kernel process exited before connecting.'
    );
    export const unknownMimeTypeFormat = localize(
        'DataScience.unknownMimeTypeFormat',
        'Mime type {0} is not currently supported'
    );
    export const exportDialogTitle = localize('DataScience.exportDialogTitle', 'Export to Jupyter Notebook');
    export const exportDialogFilter = localize('DataScience.exportDialogFilter', 'Jupyter Notebooks');
    export const exportDialogComplete = localize('DataScience.exportDialogComplete', 'Notebook written to {0}');
    export const exportDialogFailed = localize('DataScience.exportDialogFailed', 'Failed to export notebook. {0}');
    export const exportOpenQuestion = localize('DataScience.exportOpenQuestion', 'Open in browser');
    export const exportOpenQuestion1 = localize('DataScience.exportOpenQuestion1', 'Open in editor');
    export const runCellLensCommandTitle = localize('python.command.python.datascience.runcell.title', 'Run cell');
    export const importDialogTitle = localize('DataScience.importDialogTitle', 'Import Jupyter Notebook');
    export const importDialogFilter = localize('DataScience.importDialogFilter', 'Jupyter Notebooks');
    export const notebookCheckForImportTitle = localize(
        'DataScience.notebookCheckForImportTitle',
        'Do you want to import the Jupyter Notebook into Python code?'
    );
    export const notebookCheckForImportYes = localize('DataScience.notebookCheckForImportYes', 'Import');
    export const notebookCheckForImportNo = localize('DataScience.notebookCheckForImportNo', 'Later');
    export const notebookCheckForImportDontAskAgain = localize(
        'DataScience.notebookCheckForImportDontAskAgain',
        "Don't Ask Again"
    );
    export const libraryNotInstalled = localize(
        'DataScience.libraryNotInstalled',
        'Data Science library {0} is not installed. Install?'
    );
    export const couldNotInstallLibrary = localize(
        'DataScience.couldNotInstallLibrary',
        'Could not install {0}. If pip is not available, please use the package manager of your choice to manually install this library into your Python environment.'
    );
    export const libraryRequiredToLaunchJupyterNotInstalled = localize(
        'DataScience.libraryRequiredToLaunchJupyterNotInstalled',
        'Data Science library {0} is not installed.'
    );
    export const librariesRequiredToLaunchJupyterNotInstalled = localize(
        'DataScience.librariesRequiredToLaunchJupyterNotInstalled',
        'Data Science libraries {0} are not installed.'
    );
    export const libraryRequiredToLaunchJupyterNotInstalledInterpreter = localize(
        'DataScience.libraryRequiredToLaunchJupyterNotInstalledInterpreter',
        '{0} requires {1} to be installed.'
    );
    export const libraryRequiredToLaunchJupyterKernelNotInstalledInterpreter = localize(
        'DataScience.libraryRequiredToLaunchJupyterKernelNotInstalledInterpreter',
        '{0} requires {1} to be installed.'
    );
    export const librariesRequiredToLaunchJupyterNotInstalledInterpreter = localize(
        'DataScience.librariesRequiredToLaunchJupyterNotInstalledInterpreter',
        '{0} requires {1} to be installed.'
    );
    export const selectJupyterInterpreter = localize(
        'DataScience.selectJupyterInterpreter',
        'Select an Interpreter to start Jupyter'
    );
    export const jupyterInstall = localize('DataScience.jupyterInstall', 'Install');
    export const currentlySelectedJupyterInterpreterForPlaceholder = localize(
        'Datascience.currentlySelectedJupyterInterpreterForPlaceholder',
        'current: {0}'
    );
    export const jupyterNotSupported = localize(
        'DataScience.jupyterNotSupported',
        'Jupyter cannot be started. Error attempting to locate jupyter: {0}'
    );
    export const jupyterNotSupportedBecauseOfEnvironment = localize(
        'DataScience.jupyterNotSupportedBecauseOfEnvironment',
        'Activating {0} to run Jupyter failed with {1}'
    );
    export const jupyterNbConvertNotSupported = localize(
        'DataScience.jupyterNbConvertNotSupported',
        'Jupyter nbconvert is not installed'
    );
    export const jupyterLaunchTimedOut = localize(
        'DataScience.jupyterLaunchTimedOut',
        'The Jupyter notebook server failed to launch in time'
    );
    export const jupyterLaunchNoURL = localize(
        'DataScience.jupyterLaunchNoURL',
        'Failed to find the URL of the launched Jupyter notebook server'
    );
    export const jupyterSelfCertFail = localize(
        'DataScience.jupyterSelfCertFail',
        'The security certificate used by server {0} was not issued by a trusted certificate authority.\r\nThis may indicate an attempt to steal your information.\r\nDo you want to enable the Allow Unauthorized Remote Connection setting for this workspace to allow you to connect?'
    );
    export const jupyterSelfCertEnable = localize('DataScience.jupyterSelfCertEnable', 'Yes, connect anyways');
    export const jupyterSelfCertClose = localize('DataScience.jupyterSelfCertClose', 'No, close the connection');
    export const pythonInteractiveHelpLink = localize(
        'DataScience.pythonInteractiveHelpLink',
        'See [https://aka.ms/pyaiinstall] for help on installing jupyter.'
    );
    export const markdownHelpInstallingMissingDependencies = localize(
        'DataScience.markdownHelpInstallingMissingDependencies',
        'See [https://aka.ms/pyaiinstall](https://aka.ms/pyaiinstall) for help on installing Jupyter and related dependencies.'
    );
    export const importingFormat = localize('DataScience.importingFormat', 'Importing {0}');
    export const startingJupyter = localize('DataScience.startingJupyter', 'Starting Jupyter server');
    export const connectingIPyKernel = localize('DataScience.connectingToIPyKernel', 'Connecting to IPython kernel');
    export const connectedToIPyKernel = localize('DataScience.connectedToIPyKernel', 'Connected.');
    export const connectingToJupyter = localize('DataScience.connectingToJupyter', 'Connecting to Jupyter server');
    export const exportingFormat = localize('DataScience.exportingFormat', 'Exporting {0}');
    export const runAllCellsLensCommandTitle = localize(
        'python.command.python.datascience.runallcells.title',
        'Run all cells'
    );
    export const runAllCellsAboveLensCommandTitle = localize(
        'python.command.python.datascience.runallcellsabove.title',
        'Run above'
    );
    export const runCellAndAllBelowLensCommandTitle = localize(
        'python.command.python.datascience.runcellandallbelow.title',
        'Run Below'
    );
    export const importChangeDirectoryComment = localize(
        'DataScience.importChangeDirectoryComment',
        '{0} Change working directory from the workspace root to the ipynb file location. Turn this addition off with the DataScience.changeDirOnImportExport setting'
    );
    export const exportChangeDirectoryComment = localize(
        'DataScience.exportChangeDirectoryComment',
        '# Change directory to VSCode workspace root so that relative path loads work correctly. Turn this addition off with the DataScience.changeDirOnImportExport setting'
    );

    export const restartKernelMessage = localize(
        'DataScience.restartKernelMessage',
        'Do you want to restart the Jupter kernel? All variables will be lost.'
    );
    export const restartKernelMessageYes = localize('DataScience.restartKernelMessageYes', 'Restart');
    export const restartKernelMessageDontAskAgain = localize(
        'DataScience.restartKernelMessageDontAskAgain',
        "Don't Ask Again"
    );
    export const restartKernelMessageNo = localize('DataScience.restartKernelMessageNo', 'Cancel');
    export const restartingKernelStatus = localize('DataScience.restartingKernelStatus', 'Restarting IPython Kernel');
    export const restartingKernelFailed = localize(
        'DataScience.restartingKernelFailed',
        'Kernel restart failed. Jupyter server is hung. Please reload VS code.'
    );
    export const interruptingKernelFailed = localize(
        'DataScience.interruptingKernelFailed',
        'Kernel interrupt failed. Jupyter server is hung. Please reload VS code.'
    );
    export const sessionStartFailedWithKernel = localize(
        'DataScience.sessionStartFailedWithKernel',
        "Failed to start a session for the Kernel '{0}'. \nView Jupyter [log](command:{1}) for further details."
    );
    export const executingCode = localize('DataScience.executingCode', 'Executing Cell');
    export const collapseAll = localize('DataScience.collapseAll', 'Collapse all cell inputs');
    export const expandAll = localize('DataScience.expandAll', 'Expand all cell inputs');
    export const collapseSingle = localize('DataScience.collapseSingle', 'Collapse');
    export const expandSingle = localize('DataScience.expandSingle', 'Expand');
    export const exportKey = localize('DataScience.export', 'Export as Jupyter notebook');
    export const restartServer = localize('DataScience.restartServer', 'Restart IPython Kernel');
    export const undo = localize('DataScience.undo', 'Undo');
    export const redo = localize('DataScience.redo', 'Redo');
    export const save = localize('DataScience.save', 'Save file');
    export const clearAll = localize('DataScience.clearAll', 'Remove all cells');
    export const reloadRequired = localize(
        'DataScience.reloadRequired',
        'Please reload the window for new settings to take effect.'
    );
    export const pythonVersionHeader = localize('DataScience.pythonVersionHeader', 'Python Version:');
    export const pythonRestartHeader = localize('DataScience.pythonRestartHeader', 'Restarted Kernel:');
    export const pythonNewHeader = localize('DataScience.pythonNewHeader', 'Started new kernel:');
    export const pythonConnectHeader = localize('DataScience.pythonConnectHeader', 'Connected to kernel:');

    export const jupyterSelectURIPrompt = localize(
        'DataScience.jupyterSelectURIPrompt',
        'Enter the URI of the running Jupyter server'
    );
    export const jupyterSelectURIQuickPickTitle = localize(
        'DataScience.jupyterSelectURIQuickPickTitle',
        'Pick how to connect to Jupyter'
    );
    export const jupyterSelectURIQuickPickPlaceholder = localize(
        'DataScience.jupyterSelectURIQuickPickPlaceholder',
        'Choose an option'
    );
    export const jupyterSelectURILocalLabel = localize('DataScience.jupyterSelectURILocalLabel', 'Default');
    export const jupyterSelectURILocalDetail = localize(
        'DataScience.jupyterSelectURILocalDetail',
        'VS Code will automatically start a server for you on the localhost'
    );
    export const jupyterSelectURIMRUDetail = localize('DataScience.jupyterSelectURIMRUDetail', 'Last Connection: {0}');
    export const jupyterSelectURINewLabel = localize('DataScience.jupyterSelectURINewLabel', 'Existing');
    export const jupyterSelectURINewDetail = localize(
        'DataScience.jupyterSelectURINewDetail',
        'Specify the URI of an existing server'
    );
    export const jupyterSelectURIInvalidURI = localize(
        'DataScience.jupyterSelectURIInvalidURI',
        'Invalid URI specified'
    );
    export const jupyterSelectURIRunningDetailFormat = localize(
        'DataScience.jupyterSelectURIRunningDetailFormat',
        'Last activity {0}. {1} existing connections.'
    );
    export const jupyterSelectURINotRunningDetail = localize(
        'DataScience.jupyterSelectURINotRunningDetail',
        'Cannot connect at this time. Status unknown.'
    );
    export const jupyterSelectPasswordPrompt = localize(
        'DataScience.jupyterSelectPasswordPrompt',
        'Enter your notebook password'
    );
    export const jupyterNotebookFailure = localize(
        'DataScience.jupyterNotebookFailure',
        'Jupyter notebook failed to launch. \r\n{0}'
    );
    export const jupyterNotebookConnectFailed = localize(
        'DataScience.jupyterNotebookConnectFailed',
        'Failed to connect to Jupyter notebook. \r\n{0}\r\n{1}'
    );
    export const reloadAfterChangingJupyterServerConnection = localize(
        'DataScience.reloadAfterChangingJupyterServerConnection',
        'Please reload VS Code when changing the Jupyter Server connection.'
    );
    export const jupyterNotebookRemoteConnectFailed = localize(
        'DataScience.jupyterNotebookRemoteConnectFailed',
        'Failed to connect to remote Jupyter notebook.\r\nCheck that the Jupyter Server URI setting has a valid running server specified.\r\n{0}\r\n{1}'
    );
    export const jupyterNotebookRemoteConnectSelfCertsFailed = localize(
        'DataScience.jupyterNotebookRemoteConnectSelfCertsFailed',
        'Failed to connect to remote Jupyter notebook.\r\nSpecified server is using self signed certs. Enable Allow Unauthorized Remote Connection setting to connect anyways\r\n{0}\r\n{1}'
    );
    export const rawConnectionDisplayName = localize(
        'DataScience.rawConnectionDisplayName',
        'Direct kernel connection'
    );
    export const rawConnectionBrokenError = localize(
        'DataScience.rawConnectionBrokenError',
        'Direct kernel connection broken'
    );
    export const jupyterServerCrashed = localize(
        'DataScience.jupyterServerCrashed',
        'Jupyter server crashed. Unable to connect. \r\nError code from jupyter: {0}'
    );
    export const notebookVersionFormat = localize('DataScience.notebookVersionFormat', 'Jupyter Notebook Version: {0}');
    export const jupyterKernelSpecNotFound = localize(
        'DataScience.jupyterKernelSpecNotFound',
        'Cannot create a IPython kernel spec and none are available for use'
    );
    export const jupyterKernelSpecModuleNotFound = localize(
        'DataScience.jupyterKernelSpecModuleNotFound',
        "'Kernelspec' module not installed in the selected interpreter ({0}).\n Please re-install or update 'jupyter'."
    );
    export const interruptKernel = localize('DataScience.interruptKernel', 'Interrupt IPython Kernel');
    export const clearAllOutput = localize('DataScience.clearAllOutput', 'Clear All Output');
    export const interruptKernelStatus = localize('DataScience.interruptKernelStatus', 'Interrupting IPython Kernel');
    export const exportCancel = localize('DataScience.exportCancel', 'Cancel');
    export const restartKernelAfterInterruptMessage = localize(
        'DataScience.restartKernelAfterInterruptMessage',
        'Interrupting the kernel timed out. Do you want to restart the kernel instead? All variables will be lost.'
    );
    export const pythonInterruptFailedHeader = localize(
        'DataScience.pythonInterruptFailedHeader',
        'Keyboard interrupt crashed the kernel. Kernel restarted.'
    );
    export const sysInfoURILabel = localize('DataScience.sysInfoURILabel', 'Jupyter Server URI: ');
    export const executingCodeFailure = localize('DataScience.executingCodeFailure', 'Executing code failed : {0}');
    export const inputWatermark = localize('DataScience.inputWatermark', 'Type code here and press shift-enter to run');
    export const liveShareConnectFailure = localize(
        'DataScience.liveShareConnectFailure',
        'Cannot connect to host jupyter session. URI not found.'
    );
    export const liveShareCannotSpawnNotebooks = localize(
        'DataScience.liveShareCannotSpawnNotebooks',
        'Spawning jupyter notebooks is not supported over a live share connection'
    );
    export const liveShareCannotImportNotebooks = localize(
        'DataScience.liveShareCannotImportNotebooks',
        'Importing notebooks is not currently supported over a live share connection'
    );
    export const liveShareHostFormat = localize('DataScience.liveShareHostFormat', '{0} Jupyter Server');
    export const liveShareSyncFailure = localize(
        'DataScience.liveShareSyncFailure',
        'Synchronization failure during live share startup.'
    );
    export const liveShareServiceFailure = localize(
        'DataScience.liveShareServiceFailure',
        "Failure starting '{0}' service during live share connection."
    );
    export const documentMismatch = localize(
        'DataScience.documentMismatch',
        'Cannot run cells, duplicate documents for {0} found.'
    );
    export const jupyterGetVariablesBadResults = localize(
        'DataScience.jupyterGetVariablesBadResults',
        'Failed to fetch variable info from the Jupyter server.'
    );
    export const dataExplorerInvalidVariableFormat = localize(
        'DataScience.dataExplorerInvalidVariableFormat',
        "'{0}' is not an active variable."
    );
    export const pythonInteractiveCreateFailed = localize(
        'DataScience.pythonInteractiveCreateFailed',
        "Failure to create a 'Python Interactive' window. Try reinstalling the Python extension."
    );
    export const jupyterGetVariablesExecutionError = localize(
        'DataScience.jupyterGetVariablesExecutionError',
        'Failure during variable extraction: \r\n{0}'
    );
    export const loadingMessage = localize('DataScience.loadingMessage', 'loading ...');
    export const fetchingDataViewer = localize('DataScience.fetchingDataViewer', 'Fetching data ...');
    export const noRowsInDataViewer = localize('DataScience.noRowsInDataViewer', 'No rows match current filter');
    export const jupyterServer = localize('DataScience.jupyterServer', 'Jupyter Server');
    export const noKernel = localize('DataScience.noKernel', 'No Kernel');
    export const serverNotStarted = localize('DataScience.serverNotStarted', 'Not Started');
    export const selectKernel = localize('DataScience.selectKernel', 'Select a Kernel');
    export const selectDifferentKernel = localize('DataScience.selectDifferentKernel', 'Select a different Kernel');
    export const selectDifferentJupyterInterpreter = localize(
        'DataScience.selectDifferentJupyterInterpreter',
        'Select a different Interpreter'
    );
    export const localJupyterServer = localize('DataScience.localJupyterServer', 'local');
    export const pandasTooOldForViewingFormat = localize(
        'DataScience.pandasTooOldForViewingFormat',
        "Python package 'pandas' is version {0}. Version 0.20 or greater is required for viewing data."
    );
    export const pandasRequiredForViewing = localize(
        'DataScience.pandasRequiredForViewing',
        "Python package 'pandas' is required for viewing data."
    );
    export const valuesColumn = localize('DataScience.valuesColumn', 'values');
    export const liveShareInvalid = localize(
        'DataScience.liveShareInvalid',
        'One or more guests in the session do not have the Python Extension installed. Live share session cannot continue.'
    );
    export const tooManyColumnsMessage = localize(
        'DataScience.tooManyColumnsMessage',
        'Variables with over a 1000 columns may take a long time to display. Are you sure you wish to continue?'
    );
    export const tooManyColumnsYes = localize('DataScience.tooManyColumnsYes', 'Yes');
    export const tooManyColumnsNo = localize('DataScience.tooManyColumnsNo', 'No');
    export const tooManyColumnsDontAskAgain = localize('DataScience.tooManyColumnsDontAskAgain', "Don't Ask Again");
    export const filterRowsButton = localize('DataScience.filterRowsButton', 'Filter Rows');
    export const filterRowsTooltip = localize(
        'DataScience.filterRowsTooltip',
        'Allows filtering multiple rows. Use =, >, or < signs to filter numeric values.'
    );
    export const previewHeader = localize('DataScience.previewHeader', '--- Begin preview of {0} ---');
    export const previewFooter = localize('DataScience.previewFooter', '--- End preview of {0} ---');
    export const previewStatusMessage = localize('DataScience.previewStatusMessage', 'Generating preview of {0}');
    export const plotViewerTitle = localize('DataScience.plotViewerTitle', 'Plots');
    export const exportPlotTitle = localize('DataScience.exportPlotTitle', 'Save plot image');
    export const pdfFilter = localize('DataScience.pdfFilter', 'PDF');
    export const pngFilter = localize('DataScience.pngFilter', 'PNG');
    export const svgFilter = localize('DataScience.svgFilter', 'SVG');
    export const previousPlot = localize('DataScience.previousPlot', 'Previous');
    export const nextPlot = localize('DataScience.nextPlot', 'Next');
    export const panPlot = localize('DataScience.panPlot', 'Pan');
    export const zoomInPlot = localize('DataScience.zoomInPlot', 'Zoom in');
    export const zoomOutPlot = localize('DataScience.zoomOutPlot', 'Zoom out');
    export const exportPlot = localize('DataScience.exportPlot', 'Export to different formats');
    export const deletePlot = localize('DataScience.deletePlot', 'Remove');
    export const editSection = localize('DataScience.editSection', 'Input new cells here.');
    export const selectedImageListLabel = localize('DataScience.selectedImageListLabel', 'Selected Image');
    export const imageListLabel = localize('DataScience.imageListLabel', 'Image');
    export const exportImageFailed = localize('DataScience.exportImageFailed', 'Error exporting image: {0}');
    export const jupyterDataRateExceeded = localize(
        'DataScience.jupyterDataRateExceeded',
        'Cannot view variable because data rate exceeded. Please restart your server with a higher data rate limit. For example, --NotebookApp.iopub_data_rate_limit=10000000000.0'
    );
    export const addCellBelowCommandTitle = localize('DataScience.addCellBelowCommandTitle', 'Add cell');
    export const debugCellCommandTitle = localize('DataScience.debugCellCommandTitle', 'Debug cell');
    export const debugStepOverCommandTitle = localize('DataScience.debugStepOverCommandTitle', 'Step over');
    export const debugContinueCommandTitle = localize('DataScience.debugContinueCommandTitle', 'Continue');
    export const debugStopCommandTitle = localize('DataScience.debugStopCommandTitle', 'Stop');
    export const runCurrentCellAndAddBelow = localize(
        'DataScience.runCurrentCellAndAddBelow',
        'Run current and add cell below'
    );
    export const variableExplorerDisabledDuringDebugging = localize(
        'DataScience.variableExplorerDisabledDuringDebugging',
        "Please see the Debug Side Bar's VARIABLES section."
    );
    export const jupyterDebuggerNotInstalledError = localize(
        'DataScience.jupyterDebuggerNotInstalledError',
        'Pip module {0} is required for debugging cells. You will need to install it to debug cells.'
    );
    export const jupyterDebuggerOutputParseError = localize(
        'DataScience.jupyterDebuggerOutputParseError',
        'Unable to parse {0} output, please log an issue with https://github.com/microsoft/vscode-python'
    );
    export const jupyterDebuggerPortNotAvailableError = localize(
        'DataScience.jupyterDebuggerPortNotAvailableError',
        'Port {0} cannot be opened for debugging. Please specify a different port in the remoteDebuggerPort setting.'
    );
    export const jupyterDebuggerPortBlockedError = localize(
        'DataScience.jupyterDebuggerPortBlockedError',
        'Port {0} cannot be connected to for debugging. Please let port {0} through your firewall.'
    );
    export const jupyterDebuggerPortNotAvailableSearchError = localize(
        'DataScience.jupyterDebuggerPortNotAvailableSearchError',
        'Ports in the range {0}-{1} cannot be found for debugging. Please specify a port in the remoteDebuggerPort setting.'
    );
    export const jupyterDebuggerPortBlockedSearchError = localize(
        'DataScience.jupyterDebuggerPortBlockedSearchError',
        'A port cannot be connected to for debugging. Please let ports {0}-{1} through your firewall.'
    );
    export const jupyterDebuggerInstallNew = localize(
        'DataScience.jupyterDebuggerInstallNew',
        'Pip module {0} is required for debugging cells. Install {0} and continue to debug cell?'
    );
    export const jupyterDebuggerInstallNewRunByLine = localize(
        'DataScience.jupyterDebuggerInstallNewRunByLine',
        'Pip module {0} is required for running by line. Install {0} and continue to run by line?'
    );
    export const jupyterDebuggerInstallUpdate = localize(
        'DataScience.jupyterDebuggerInstallUpdate',
        'The version of {0} installed does not support debugging cells. Update {0} to newest version and continue to debug cell?'
    );
    export const jupyterDebuggerInstallUpdateRunByLine = localize(
        'DataScience.jupyterDebuggerInstallUpdateRunByLine',
        'The version of {0} installed does not support running by line. Update {0} to newest version and continue to run by line?'
    );
    export const jupyterDebuggerInstallYes = localize('DataScience.jupyterDebuggerInstallYes', 'Yes');
    export const jupyterDebuggerInstallNo = localize('DataScience.jupyterDebuggerInstallNo', 'No');
    export const cellStopOnErrorFormatMessage = localize(
        'DataScience.cellStopOnErrorFormatMessage',
        '{0} cells were canceled due to an error in the previous cell.'
    );
    export const scrollToCellTitleFormatMessage = localize('DataScience.scrollToCellTitleFormatMessage', 'Go to [{0}]');
    export const instructionComments = localize(
        'DataScience.instructionComments',
        '# To add a new cell, type "{0}"\n# To add a new markdown cell, type "{0} [markdown]"\n'
    );
    export const invalidNotebookFileError = localize(
        'DataScience.invalidNotebookFileError',
        'Notebook is not in the correct format. Check the file for correct json.'
    );
    export const invalidNotebookFileErrorFormat = localize(
        'DataScience.invalidNotebookFileError',
        '{0} is not a valid notebook file. Check the file for correct json.'
    );
    export const nativeEditorTitle = localize('DataScience.nativeEditorTitle', 'Notebook Editor');
    export const untitledNotebookFileName = localize('DataScience.untitledNotebookFileName', 'Untitled');
    export const dirtyNotebookMessage1 = localize(
        'DataScience.dirtyNotebookMessage1',
        'Do you want to save the changes you made to {0}?'
    );
    export const dirtyNotebookMessage2 = localize(
        'DataScience.dirtyNotebookMessage2',
        "Your changes will be lost if you don't save them."
    );
    export const dirtyNotebookYes = localize('DataScience.dirtyNotebookYes', 'Save');
    export const dirtyNotebookNo = localize('DataScience.dirtyNotebookNo', "Don't Save");
    export const dirtyNotebookCancel = localize('DataScience.dirtyNotebookCancel', 'Cancel');
    export const dirtyNotebookDialogTitle = localize('DataScience.dirtyNotebookDialogTitle', 'Save');
    export const dirtyNotebookDialogFilter = localize('DataScience.dirtyNotebookDialogFilter', 'Jupyter Notebooks');
    export const remoteDebuggerNotSupported = localize(
        'DataScience.remoteDebuggerNotSupported',
        'Debugging while attached to a remote server is not currently supported.'
    );
    export const exportAsPythonFileTooltip = localize(
        'DataScience.exportAsPythonFileTooltip',
        'Convert and save to a python script'
    );
    export const exportAsPythonFileTitle = localize('DataScience.exportAsPythonFileTitle', 'Save As Python File');
    export const runCell = localize('DataScience.runCell', 'Run cell');
    export const deleteCell = localize('DataScience.deleteCell', 'Delete cell');
    export const moveCellUp = localize('DataScience.moveCellUp', 'Move cell up');
    export const moveCellDown = localize('DataScience.moveCellDown', 'Move cell down');
    export const moveSelectedCellUp = localize('DataScience.moveSelectedCellUp', 'Move selected cell up');
    export const moveSelectedCellDown = localize('DataScience.deleteCell', 'Move selected cell down');
    export const insertBelow = localize('DataScience.insertBelow', 'Insert cell below');
    export const insertAbove = localize('DataScience.insertAbove', 'Insert cell above');
    export const addCell = localize('DataScience.addCell', 'Add cell');
    export const runAll = localize('DataScience.runAll', 'Insert cell');
    export const convertingToPythonFile = localize(
        'DataScience.convertingToPythonFile',
        'Converting ipynb to python file'
    );
    export const noInterpreter = localize('DataScience.noInterpreter', 'No python selected');
    export const notebookNotFound = localize(
        'DataScience.notebookNotFound',
        'python -m jupyter notebook --version is not running'
    );
    export const findJupyterCommandProgress = localize(
        'DataScience.findJupyterCommandProgress',
        'Active interpreter does not support {0}. Searching for the best available interpreter.'
    );
    export const findJupyterCommandProgressCheckInterpreter = localize(
        'DataScience.findJupyterCommandProgressCheckInterpreter',
        'Checking {0}.'
    );
    export const findJupyterCommandProgressSearchCurrentPath = localize(
        'DataScience.findJupyterCommandProgressSearchCurrentPath',
        'Searching current path.'
    );
    export const gatheredScriptDescription = localize(
        'DataScience.gatheredScriptDescription',
        '# This file was generated by an experimental feature called "Gather".\n#\n#     The intent is that it contains only the code required to produce\n#     the same results as the cell originally selected for gathering.\n#     Please note that the Python analysis is quite conservative, so if\n#     it is unsure whether a line of code is necessary for execution, it\n#     will err on the side of including it.\n#\n# Please let us know if you are satisfied with what was gathered here:\n# https://aka.ms/gathersurvey\n\n'
    );
    export const gatheredNotebookDescriptionInMarkdown = localize(
        'DataScience.gatheredNotebookDescriptionInMarkdown',
        '# Gathered Notebook\nGathered from ```{0}```\n\n|   |   |\n|---|---|\n|&nbsp;&nbsp;&nbsp|This notebook was generated by an experimental feature called "Gather". The intent is that it contains only the code and cells required to produce the same results as the cell originally selected for gathering. Please note that the Python analysis is quite conservative, so if it is unsure whether a line of code is necessary for execution, it will err on the side of including it.|\n\n**Are you satisfied with the code that was gathered?**\n\n[Yes](https://command:python.datascience.gatherquality?yes) [No](https://command:python.datascience.gatherquality?no)'
    );
    export const savePngTitle = localize('DataScience.savePngTitle', 'Save Image');
    export const fallbackToUseActiveInterpeterAsKernel = localize(
        'DataScience.fallbackToUseActiveInterpeterAsKernel',
        "Couldn't find kernel '{0}' that the notebook was created with. Using the current interpreter."
    );
    export const fallBackToRegisterAndUseActiveInterpeterAsKernel = localize(
        'DataScience.fallBackToRegisterAndUseActiveInterpeterAsKernel',
        "Couldn't find kernel '{0}' that the notebook was created with. Registering a new kernel using the current interpreter."
    );
    export const fallBackToPromptToUseActiveInterpreterOrSelectAKernel = localize(
        'DataScience.fallBackToPromptToUseActiveInterpreterOrSelectAKernel',
        "Couldn't find kernel '{0}' that the notebook was created with."
    );
    export const startingJupyterLogMessage = localize(
        'DataScience.startingJupyterLogMessage',
        'Starting Jupyter from {0}'
    );
    export const jupyterStartTimedout = localize(
        'DataScience.jupyterStartTimedout',
        "Starting Jupyter has timedout. Please check the 'Jupyter' output panel for further details."
    );
    export const switchingKernelProgress = localize('DataScience.switchingKernelProgress', "Switching Kernel to '{0}'");
    export const waitingForJupyterSessionToBeIdle = localize(
        'DataScience.waitingForJupyterSessionToBeIdle',
        'Waiting for Jupyter Session to be idle'
    );
    export const gettingListOfKernelsForLocalConnection = localize(
        'DataScience.gettingListOfKernelsForLocalConnection',
        'Fetching Kernels'
    );
    export const gettingListOfKernelsForRemoteConnection = localize(
        'DataScience.gettingListOfKernelsForRemoteConnection',
        'Fetching Kernels'
    );
    export const gettingListOfKernelSpecs = localize('DataScience.gettingListOfKernelSpecs', 'Fetching Kernel specs');
    export const startingJupyterNotebook = localize('DataScience.startingJupyterNotebook', 'Starting Jupyter Notebook');
    export const registeringKernel = localize('DataScience.registeringKernel', 'Registering Kernel');
    export const trimmedOutput = localize(
        'DataScience.trimmedOutput',
        'Output was trimmed for performance reasons.\nTo see the full output set the setting "python.dataScience.textOutputLimit" to 0.'
    );
    export const jupyterCommandLineDefaultLabel = localize('DataScience.jupyterCommandLineDefaultLabel', 'Default');
    export const jupyterCommandLineDefaultDetail = localize(
        'DataScience.jupyterCommandLineDefaultDetail',
        'The Python extension will determine the appropriate command line for Jupyter'
    );
    export const jupyterCommandLineCustomLabel = localize('DataScience.jupyterCommandLineCustomLabel', 'Custom');
    export const jupyterCommandLineCustomDetail = localize(
        'DataScience.jupyterCommandLineCustomDetail',
        'Customize the command line passed to Jupyter on startup'
    );
    export const jupyterCommandLineReloadQuestion = localize(
        'DataScience.jupyterCommandLineReloadQuestion',
        'Please reload the window when changing the Jupyter command line.'
    );
    export const jupyterCommandLineReloadAnswer = localize('DataScience.jupyterCommandLineReloadAnswer', 'Reload');
    export const jupyterCommandLineQuickPickPlaceholder = localize(
        'DataScience.jupyterCommandLineQuickPickPlaceholder',
        'Choose an option'
    );
    export const jupyterCommandLineQuickPickTitle = localize(
        'DataScience.jupyterCommandLineQuickPickTitle',
        'Pick command line for Jupyter'
    );
    export const jupyterCommandLinePrompt = localize(
        'DataScience.jupyterCommandLinePrompt',
        'Enter your custom command line for Jupyter'
    );

    export const connectingToJupyterUri = localize(
        'DataScience.connectingToJupyterUri',
        'Connecting to Jupyter server at {0}'
    );
    export const createdNewNotebook = localize('DataScience.createdNewNotebook', '{0}: Creating new notebook ');

    export const createdNewKernel = localize('DataScience.createdNewKernel', '{0}: Kernel started: {1}');
    export const kernelInvalid = localize(
        'DataScience.kernelInvalid',
        'Kernel {0} is not usable. Check the Jupyter output tab for more information.'
    );

    export const nativeDependencyFail = localize(
        'DataScience.nativeDependencyFail',
        '{0}. We cannot launch a jupyter server for you because your OS is not supported. Select an already running server if you wish to continue.'
    );

    export const selectNewServer = localize('DataScience.selectNewServer', 'Pick Running Server');
    export const jupyterSelectURIRemoteLabel = localize('DataScience.jupyterSelectURIRemoteLabel', 'Existing');
    export const jupyterSelectURIQuickPickTitleRemoteOnly = localize(
        'DataScience.jupyterSelectURIQuickPickTitleRemoteOnly',
        'Pick an already running jupyter server'
    );
    export const jupyterSelectURIRemoteDetail = localize(
        'DataScience.jupyterSelectURIRemoteDetail',
        'Specify the URI of an existing server'
    );

    export const loadClassFailedWithNoInternet = localize(
        'DataScience.loadClassFailedWithNoInternet',
        'Error loading {0}:{1}. Internet connection required for loading 3rd party widgets.'
    );
    export const loadThirdPartyWidgetScriptsPostEnabled = localize(
        'DataScience.loadThirdPartyWidgetScriptsPostEnabled',
        "Please restart the Kernel when changing the setting 'python.dataScience.widgetScriptSources'."
    );
    export const useCDNForWidgets = localize(
        'DataScience.useCDNForWidgets',
        'Widgets require us to download supporting files from a 3rd party website. Click [here](https://aka.ms/PVSCIPyWidgets) for more information.'
    );
    export const enableCDNForWidgetsSetting = localize(
        'DataScience.enableCDNForWidgetsSetting',
        "Widgets require us to download supporting files from a 3rd party website. Click <a href='https://command:python.datascience.enableLoadingWidgetScriptsFromThirdPartySource'>here</a> to enable this or click <a href='https://aka.ms/PVSCIPyWidgets'>here</a> for more information. (Error loading {0}:{1})."
    );

    export const unhandledMessage = localize(
        'DataScience.unhandledMessage',
        'Unhandled kernel message from a widget: {0} : {1}'
    );

    export const widgetScriptNotFoundOnCDNWidgetMightNotWork = localize(
        'DataScience.widgetScriptNotFoundOnCDNWidgetMightNotWork',
        "Unable to load a compatible version of the widget '{0}'. Expected behavior may be affected."
    );
    export const qgridWidgetScriptVersionCompatibilityWarning = localize(
        'DataScience.qgridWidgetScriptVersionCompatibilityWarning',
        "Unable to load a compatible version of the widget 'qgrid'. Consider downgrading to version 1.1.1."
    );

    export const kernelStarted = localize('DataScience.kernelStarted', 'Started kernel {0}.');
    export const runByLine = localize('DataScience.runByLine', 'Run by line');
    export const continueRunByLine = localize('DataScience.continueRunByLine', 'Stop');
    export const rawKernelSessionFailed = localize(
        'DataScience.rawKernelSessionFailed',
        'Unable to start session for kernel {0}. Select another kernel to launch with.'
    );
}

export namespace StartPage {
    export const getStarted = localize('StartPage.getStarted', 'Python - Get Started');
    export const pythonExtensionTitle = localize('StartPage.pythonExtensionTitle', 'Python Extension');
    export const createJupyterNotebook = localize('StartPage.createJupyterNotebook', 'Create a Jupyter Notebook');
    export const notebookDescription = localize(
        'StartPage.notebookDescription',
        '- Use "<div class="italics">Shift + Command + P</div> " to open the <div class="link" role="button" onclick={0}>Command Palette</div><br />- Type "<div class="link italics" role="button" onclick={1}>Create New Blank Jupyter Notebook</div> "<br />- Explore our <div class="link" role="button" onclick={2}>sample notebook</div> to learn about notebook features'
    );
    export const createAPythonFile = localize('StartPage.createAPythonFile', 'Create a Python File');
    export const pythonFileDescription = localize(
        'StartPage.pythonFileDescription',
        '- Create a new file and use the .py extension<br />- <div class="link" role="button" onclick={0}>Open a file or workspace</div> to continue work'
    );
    export const openInteractiveWindow = localize('StartPage.openInteractiveWindow', 'Open the Interactive Window');
    export const interactiveWindowDesc = localize(
        'StartPage.interactiveWindowDesc',
        '- You can create cells on a Python file by typing "#%%" <br /> - Use "<div class="italics">Shift + Enter</div> " to run a cell, the output will be shown in the interactive window'
    );

    export const releaseNotes = localize(
        'StartPage.releaseNotes',
        'Take a look at our <a class="link" href={0}>Release Notes</a> to learn more about the latest features'
    );
    export const tutorialAndDoc = localize(
        'StartPage.tutorialAndDoc',
        'Explore more features in our <a class="link" href={0}>Tutorials</a> or check <a class="link" href={1}>Documentation</a> for tips and troubleshooting.'
    );
    export const dontShowAgain = localize('StartPage.dontShowAgain', "Don't show this page again");
    export const helloWorld = localize('StartPage.helloWorld', 'Hello world');
    // When localizing sampleNotebook, the translated notebook must also be included in
    // pythonFiles\*
    export const sampleNotebook = localize('StartPage.sampleNotebook', 'Welcome_To_VSCode_Notebooks.ipynb');
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
        'We noticed you are attaching to ptvsd (Python debugger), which will be deprecated on May 1st, 2020. Please switch to [debugpy](https://aka.ms/migrateToDebugpy).'
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
