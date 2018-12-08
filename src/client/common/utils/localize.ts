// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../constants';

// External callers of localize use these tables to retrieve localized values.
export namespace Diagnostics {
    export const warnSourceMaps = localize('diagnostics.warnSourceMaps', 'Source map support is enabled in the Python Extension, this will adversely impact performance of the extension.');
    export const disableSourceMaps = localize('diagnostics.disableSourceMaps', 'Disable Source Map Support');
    export const warnBeforeEnablingSourceMaps = localize('diagnostics.warnBeforeEnablingSourceMaps', 'Enabling source map support in the Python Extension will adversely impact performance of the extension.');
    export const enableSourceMapsAndReloadVSC = localize('diagnostics.enableSourceMapsAndReloadVSC', 'Enable and reload Window.');
}

export namespace Common {
    export const canceled = localize('Common.canceled', 'Canceled');
}

export namespace LanguageServiceSurveyBanner {
    export const bannerMessage = localize('LanguageServiceSurveyBanner.bannerMessage', 'Can you please take 2 minutes to tell us how the Python Language Server is working for you?');
    export const bannerLabelYes = localize('LanguageServiceSurveyBanner.bannerLabelYes', 'Yes, take survey now');
    export const bannerLabelNo = localize('LanguageServiceSurveyBanner.bannerLabelNo', 'No, thanks');
}

export namespace Interpreters {
    export const loading = localize('Interpreters.LoadingInterpreters', 'Loading Python Interpreters');
    export const refreshing = localize('Interpreters.RefreshingInterpreters', 'Refreshing Python Interpreters');
}

export namespace Linters {
    export const installedButNotEnabled = localize('Linter.InstalledButNotEnabled', 'Linter {0} is installed but not enabled.');
}

export namespace DataScienceSurveyBanner {
    export const bannerMessage = localize('DataScienceSurveyBanner.bannerMessage', 'Can you please take 2 minutes to tell us how the Python Data Science features are working for you?');
    export const bannerLabelYes = localize('DataScienceSurveyBanner.bannerLabelYes', 'Yes, take survey now');
    export const bannerLabelNo = localize('DataScienceSurveyBanner.bannerLabelNo', 'No, thanks');
}

export namespace DataScience {
    export const historyTitle = localize('DataScience.historyTitle', 'Python Interactive');
    export const badWebPanelFormatString = localize('DataScience.badWebPanelFormatString', '<html><body><h1>{0} is not a valid file name</h1></body></html>');
    export const sessionDisposed = localize('DataScience.sessionDisposed', 'Cannot execute code, session has been disposed.');
    export const unknownMimeType = localize('DataScience.unknownMimeType', 'Unknown mime type for data');
    export const exportDialogTitle = localize('DataScience.exportDialogTitle', 'Export to Jupyter Notebook');
    export const exportDialogFilter = localize('DataScience.exportDialogFilter', 'Jupyter Notebooks');
    export const exportDialogComplete = localize('DataScience.exportDialogComplete', 'Notebook written to {0}');
    export const exportDialogFailed = localize('DataScience.exportDialogFailed', 'Failed to export notebook. {0}');
    export const exportOpenQuestion = localize('DataScience.exportOpenQuestion', 'Open in browser');
    export const runCellLensCommandTitle = localize('python.command.python.datascience.runcell.title', 'Run cell');
    export const importDialogTitle = localize('DataScience.importDialogTitle', 'Import Jupyter Notebook');
    export const importDialogFilter = localize('DataScience.importDialogFilter', 'Jupyter Notebooks');
    export const notebookCheckForImportTitle = localize('DataScience.notebookCheckForImportTitle', 'Do you want to import the Jupyter Notebook into Python code?');
    export const notebookCheckForImportYes = localize('DataScience.notebookCheckForImportYes', 'Import');
    export const notebookCheckForImportNo = localize('DataScience.notebookCheckForImportNo', 'Later');
    export const notebookCheckForImportDontAskAgain = localize('DataScience.notebookCheckForImportDontAskAgain', 'Don\'t Ask Again');
    export const jupyterNotSupported = localize('DataScience.jupyterNotSupported', 'Jupyter is not installed');
    export const jupyterNbConvertNotSupported = localize('DataScience.jupyterNbConvertNotSupported', 'Jupyter nbconvert is not installed');
    export const jupyterLaunchTimedOut = localize('DataScience.jupyterLaunchTimedOut', 'The Jupyter notebook server failed to launch in time');
    export const jupyterLaunchNoURL = localize('DataScience.jupyterLaunchNoURL', 'Failed to find the URL of the launched Jupyter notebook server');
    export const pythonInteractiveHelpLink = localize('DataScience.pythonInteractiveHelpLink', 'See [https://aka.ms/pyaiinstall] for help on installing jupyter.');
    export const importingFormat = localize('DataScience.importingFormat', 'Importing {0}');
    export const startingJupyter = localize('DataScience.startingJupyter', 'Starting Jupyter server');
    export const connectingToJupyter = localize('DataScience.connectingToJupyter', 'Connecting to Jupyter server');
    export const exportingFormat = localize('DataScience.exportingFormat', 'Exporting {0}');
    export const runAllCellsLensCommandTitle = localize('python.command.python.datascience.runallcells.title', 'Run all cells');
    export const importChangeDirectoryComment = localize('DataScience.importChangeDirectoryComment', '#%% Change working directory from the workspace root to the ipynb file location. Turn this addition off with the DataSciece.changeDirOnImportExport setting');
    export const exportChangeDirectoryComment = localize('DataScience.exportChangeDirectoryComment', '# Change directory to VSCode workspace root so that relative path loads work correctly. Turn this addition off with the DataSciece.changeDirOnImportExport setting');

    export const restartKernelMessage = localize('DataScience.restartKernelMessage', 'Do you want to restart the Jupter kernel? All variables will be lost.');
    export const restartKernelMessageYes = localize('DataScience.restartKernelMessageYes', 'Restart');
    export const restartKernelMessageNo = localize('DataScience.restartKernelMessageNo', 'Cancel');
    export const restartingKernelStatus = localize('DataScience.restartingKernelStatus', 'Restarting iPython Kernel');
    export const executingCode = localize('DataScience.executingCode', 'Executing Cell');
    export const collapseAll = localize('DataScience.collapseAll', 'Collapse all cell inputs');
    export const expandAll = localize('DataScience.expandAll', 'Expand all cell inputs');
    export const exportKey = localize('DataScience.export', 'Export as Jupyter Notebook');
    export const restartServer = localize('DataScience.restartServer', 'Restart iPython Kernel');
    export const undo = localize('DataScience.undo', 'Undo');
    export const redo = localize('DataScience.redo', 'Redo');
    export const clearAll = localize('DataScience.clearAll', 'Remove All Cells');
    export const pythonVersionHeader = localize('DataScience.pythonVersionHeader', 'Python Version:');
    export const pythonRestartHeader = localize('DataScience.pythonRestartHeader', 'Restarted Kernel:');
    export const pythonVersionHeaderNoPyKernel = localize('DataScience.pythonVersionHeaderNoPyKernel', 'Python Version may not match, no ipykernel found:');

    export const jupyterSelectURILaunchLocal = localize('DataScience.jupyterSelectURILaunchLocal', 'Launch local Jupyter server');
    export const jupyterSelectURISpecifyURI = localize('DataScience.jupyterSelectURISpecifyURI', 'Type in the URI for the Jupyter server');
    export const jupyterSelectURIPrompt = localize('DataScience.jupyterSelectURIPrompt', 'Enter the URI of a Jupyter server');
    export const jupyterSelectURIInvalidURI = localize('DataScience.jupyterSelectURIInvalidURI', 'Invalid URI specified');
    export const jupyterNotebookFailure = localize('DataScience.jupyterNotebookFailure', 'Jupyter notebook failed to launch. \r\n{0}');
    export const jupyterNotebookConnectFailed = localize('DataScience.jupyterNotebookConnectFailed', 'Failed to connect to Jupyter notebook. \r\n{0}');
    export const notebookVersionFormat = localize('DataScience.notebookVersionFormat', 'Jupyter Notebook Version: {0}');
    //tslint:disable-next-line:no-multiline-string
    export const jupyterKernelNotSupportedOnActive = localize('DataScience.jupyterKernelNotSupportedOnActive', `iPython kernel cannot be started from '{0}'. Using closest match {1} instead.`);
    export const jupyterKernelSpecNotFound = localize('DataScience.jupyterKernelSpecNotFound', 'Cannot create a iPython kernel spec and none are available for use');
    export const interruptKernel = localize('DataScience.interruptKernel', 'Interrupt iPython Kernel');
    export const exportCancel = localize('DataScience.exportCancel', 'Cancel');
}

// Skip using vscode-nls and instead just compute our strings based on key values. Key values
// can be loaded out of the nls.<locale>.json files
let loadedCollection: { [index: string]: string } | undefined;
let defaultCollection: { [index: string]: string } | undefined;
const askedForCollection: { [index: string]: string } = {};
let loadedLocale: string;

export function localize(key: string, defValue: string) {
    // Return a pointer to function so that we refetch it on each call.
    return () => {
        return getString(key, defValue);
    };
}

export function getCollection() {
    // Load the current collection
    if (!loadedCollection || parseLocale() !== loadedLocale) {
        load();
    }

    // Combine the default and loaded collections
    return { ...defaultCollection, ...loadedCollection };
}

export function getAskedForCollection() {
    return askedForCollection;
}

function parseLocale(): string {
    // Attempt to load from the vscode locale. If not there, use english
    const vscodeConfigString = process.env.VSCODE_NLS_CONFIG;
    return vscodeConfigString ? JSON.parse(vscodeConfigString).locale : 'en-us';
}

function getString(key: string, defValue: string) {
    // Load the current collection
    if (!loadedCollection || parseLocale() !== loadedLocale) {
        load();
    }

    // First lookup in the dictionary that matches the current locale
    if (loadedCollection && loadedCollection.hasOwnProperty(key)) {
        askedForCollection[key] = loadedCollection[key];
        return loadedCollection[key];
    }

    // Fallback to the default dictionary
    if (defaultCollection && defaultCollection.hasOwnProperty(key)) {
        askedForCollection[key] = defaultCollection[key];
        return defaultCollection[key];
    }

    // Not found, return the default
    askedForCollection[key] = defValue;
    return defValue;
}

function load() {
    // Figure out our current locale.
    loadedLocale = parseLocale();

    // Find the nls file that matches (if there is one)
    const nlsFile = path.join(EXTENSION_ROOT_DIR, `package.nls.${loadedLocale}.json`);
    if (fs.existsSync(nlsFile)) {
        const contents = fs.readFileSync(nlsFile, 'utf8');
        loadedCollection = JSON.parse(contents);
    } else {
        // If there isn't one, at least remember that we looked so we don't try to load a second time
        loadedCollection = {};
    }

    // Get the default collection if necessary. Strings may be in the default or the locale json
    if (!defaultCollection) {
        const defaultNlsFile = path.join(EXTENSION_ROOT_DIR, 'package.nls.json');
        if (fs.existsSync(defaultNlsFile)) {
            const contents = fs.readFileSync(defaultNlsFile, 'utf8');
            defaultCollection = JSON.parse(contents);
        } else {
            defaultCollection = {};
        }
    }
}

// Default to loading the current locale
load();
