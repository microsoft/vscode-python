// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export const DefaultTheme = 'Default Light+';
export const GatherExtension = 'ms-python.gather';

export enum Telemetry {
    ShiftEnterBannerShown = 'DS_INTERNAL.SHIFTENTER_BANNER_SHOWN',
    EnableInteractiveShiftEnter = 'DATASCIENCE.ENABLE_INTERACTIVE_SHIFT_ENTER',
    DisableInteractiveShiftEnter = 'DATASCIENCE.DISABLE_INTERACTIVE_SHIFT_ENTER',
    WebviewStartup = 'DS_INTERNAL.WEBVIEW_STARTUP',
    WebviewStyleUpdate = 'DS_INTERNAL.WEBVIEW_STYLE_UPDATE',
    WebviewMonacoStyleUpdate = 'DS_INTERNAL.WEBVIEW_MONACO_STYLE_UPDATE',
    StartPageViewed = 'DS_INTERNAL.STARTPAGE_VIEWED',
    StartPageOpenedFromCommandPalette = 'DS_INTERNAL.STARTPAGE_OPENED_FROM_COMMAND_PALETTE',
    StartPageOpenedFromNewInstall = 'DS_INTERNAL.STARTPAGE_OPENED_FROM_NEW_INSTALL',
    StartPageOpenedFromNewUpdate = 'DS_INTERNAL.STARTPAGE_OPENED_FROM_NEW_UPDATE',
    StartPageWebViewError = 'DS_INTERNAL.STARTPAGE_WEBVIEWERROR',
    StartPageTime = 'DS_INTERNAL.STARTPAGE_TIME',
    StartPageClickedDontShowAgain = 'DATASCIENCE.STARTPAGE_DONT_SHOW_AGAIN',
    StartPageClosedWithoutAction = 'DATASCIENCE.STARTPAGE_CLOSED_WITHOUT_ACTION',
    StartPageUsedAnActionOnFirstTime = 'DATASCIENCE.STARTPAGE_USED_ACTION_ON_FIRST_TIME',
    StartPageOpenBlankNotebook = 'DATASCIENCE.STARTPAGE_OPEN_BLANK_NOTEBOOK',
    StartPageOpenBlankPythonFile = 'DATASCIENCE.STARTPAGE_OPEN_BLANK_PYTHON_FILE',
    StartPageOpenInteractiveWindow = 'DATASCIENCE.STARTPAGE_OPEN_INTERACTIVE_WINDOW',
    StartPageOpenCommandPalette = 'DATASCIENCE.STARTPAGE_OPEN_COMMAND_PALETTE',
    StartPageOpenCommandPaletteWithOpenNBSelected = 'DATASCIENCE.STARTPAGE_OPEN_COMMAND_PALETTE_WITH_OPENNBSELECTED',
    StartPageOpenSampleNotebook = 'DATASCIENCE.STARTPAGE_OPEN_SAMPLE_NOTEBOOK',
    StartPageOpenFileBrowser = 'DATASCIENCE.STARTPAGE_OPEN_FILE_BROWSER',
    StartPageOpenFolder = 'DATASCIENCE.STARTPAGE_OPEN_FOLDER',
    StartPageOpenWorkspace = 'DATASCIENCE.STARTPAGE_OPEN_WORKSPACE'
}

export namespace Commands {
    export const RunAllCells = 'python.datascience.runallcells';
    export const OpenNotebook = 'python.datascience.opennotebook';
}
