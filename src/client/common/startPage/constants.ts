// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable */

'use strict';

export const DefaultTheme = 'Default Light+';
export const GatherExtension = 'ms-python.gather';

export enum Telemetry {
    ImportNotebook = 'DATASCIENCE.IMPORT_NOTEBOOK',
    RunCell = 'DATASCIENCE.RUN_CELL',
    RunCurrentCell = 'DATASCIENCE.RUN_CURRENT_CELL',
    RunCurrentCellAndAdvance = 'DATASCIENCE.RUN_CURRENT_CELL_AND_ADVANCE',
    RunAllCells = 'DATASCIENCE.RUN_ALL_CELLS',
    RunAllCellsAbove = 'DATASCIENCE.RUN_ALL_CELLS_ABOVE',
    RunCellAndAllBelow = 'DATASCIENCE.RUN_CELL_AND_ALL_BELOW',
    AddEmptyCellToBottom = 'DATASCIENCE.RUN_ADD_EMPTY_CELL_TO_BOTTOM',
    RunCurrentCellAndAddBelow = 'DATASCIENCE.RUN_CURRENT_CELL_AND_ADD_BELOW',
    InsertCellBelowPosition = 'DATASCIENCE.RUN_INSERT_CELL_BELOW_POSITION',
    InsertCellBelow = 'DATASCIENCE.RUN_INSERT_CELL_BELOW',
    InsertCellAbove = 'DATASCIENCE.RUN_INSERT_CELL_ABOVE',
    DeleteCells = 'DATASCIENCE.RUN_DELETE_CELLS',
    SelectCell = 'DATASCIENCE.RUN_SELECT_CELL',
    SelectCellContents = 'DATASCIENCE.RUN_SELECT_CELL_CONTENTS',
    ExtendSelectionByCellAbove = 'DATASCIENCE.RUN_EXTEND_SELECTION_BY_CELL_ABOVE',
    ExtendSelectionByCellBelow = 'DATASCIENCE.RUN_EXTEND_SELECTION_BY_CELL_BELOW',
    MoveCellsUp = 'DATASCIENCE.RUN_MOVE_CELLS_UP',
    MoveCellsDown = 'DATASCIENCE.RUN_MOVE_CELLS_DOWN',
    ChangeCellToMarkdown = 'DATASCIENCE.RUN_CHANGE_CELL_TO_MARKDOWN',
    ChangeCellToCode = 'DATASCIENCE.RUN_CHANGE_CELL_TO_CODE',
    GotoNextCellInFile = 'DATASCIENCE.GOTO_NEXT_CELL_IN_FILE',
    GotoPrevCellInFile = 'DATASCIENCE.GOTO_PREV_CELL_IN_FILE',
    RunSelectionOrLine = 'DATASCIENCE.RUN_SELECTION_OR_LINE',
    RunToLine = 'DATASCIENCE.RUN_TO_LINE',
    RunFromLine = 'DATASCIENCE.RUN_FROM_LINE',
    DeleteAllCells = 'DATASCIENCE.DELETE_ALL_CELLS',
    DeleteCell = 'DATASCIENCE.DELETE_CELL',
    GotoSourceCode = 'DATASCIENCE.GOTO_SOURCE',
    CopySourceCode = 'DATASCIENCE.COPY_SOURCE',
    RestartKernel = 'DS_INTERNAL.RESTART_KERNEL',
    RestartKernelCommand = 'DATASCIENCE.RESTART_KERNEL_COMMAND',
    ExportNotebookInteractive = 'DATASCIENCE.EXPORT_NOTEBOOK',
    Undo = 'DATASCIENCE.UNDO',
    Redo = 'DATASCIENCE.REDO',
    /**
     * Saving a notebook
     */
    Save = 'DATASCIENCE.SAVE',
    CellCount = 'DS_INTERNAL.CELL_COUNT',
    /**
     * Whether auto save feature in VS Code is enabled or not.
     */
    CreateNewInteractive = 'DATASCIENCE.CREATE_NEW_INTERACTIVE',
    ExpandAll = 'DATASCIENCE.EXPAND_ALL',
    CollapseAll = 'DATASCIENCE.COLLAPSE_ALL',
    SelectJupyterURI = 'DATASCIENCE.SELECT_JUPYTER_URI',
    SelectLocalJupyterKernel = 'DATASCIENCE.SELECT_LOCAL_JUPYTER_KERNEL',
    SelectRemoteJupyterKernel = 'DATASCIENCE.SELECT_REMOTE_JUPYTER_KERNEL',
    SetJupyterURIToLocal = 'DATASCIENCE.SET_JUPYTER_URI_LOCAL',
    SetJupyterURIToUserSpecified = 'DATASCIENCE.SET_JUPYTER_URI_USER_SPECIFIED',
    Interrupt = 'DATASCIENCE.INTERRUPT',
    /**
     * Exporting from the interactive window
     */
    ExportPythonFileInteractive = 'DATASCIENCE.EXPORT_PYTHON_FILE',
    ExportPythonFileAndOutputInteractive = 'DATASCIENCE.EXPORT_PYTHON_FILE_AND_OUTPUT',
    /**
     * User clicked export as quick pick button
     */
    ClickedExportNotebookAsQuickPick = 'DATASCIENCE.CLICKED_EXPORT_NOTEBOOK_AS_QUICK_PICK',
    /**
     * exported a notebook
     */
    ExportNotebookAs = 'DATASCIENCE.EXPORT_NOTEBOOK_AS',
    /**
     * User invokes export as format from command pallet
     */
    ExportNotebookAsCommand = 'DATASCIENCE.EXPORT_NOTEBOOK_AS_COMMAND',
    /**
     * An export to a specific format failed
     */
    ExportNotebookAsFailed = 'DATASCIENCE.EXPORT_NOTEBOOK_AS_FAILED',

    StartJupyter = 'DS_INTERNAL.JUPYTERSTARTUPCOST',
    SubmitCellThroughInput = 'DATASCIENCE.SUBMITCELLFROMREPL',
    ConnectLocalJupyter = 'DS_INTERNAL.CONNECTLOCALJUPYTER',
    ConnectRemoteJupyter = 'DS_INTERNAL.CONNECTREMOTEJUPYTER',
    ConnectRemoteJupyterViaLocalHost = 'DS_INTERNAL.CONNECTREMOTEJUPYTER_VIA_LOCALHOST',
    ConnectFailedJupyter = 'DS_INTERNAL.CONNECTFAILEDJUPYTER',
    ConnectRemoteFailedJupyter = 'DS_INTERNAL.CONNECTREMOTEFAILEDJUPYTER',
    StartSessionFailedJupyter = 'DS_INTERNAL.START_SESSION_FAILED_JUPYTER',
    ConnectRemoteSelfCertFailedJupyter = 'DS_INTERNAL.CONNECTREMOTESELFCERTFAILEDJUPYTER',
    RegisterAndUseInterpreterAsKernel = 'DS_INTERNAL.REGISTER_AND_USE_INTERPRETER_AS_KERNEL',
    UseInterpreterAsKernel = 'DS_INTERNAL.USE_INTERPRETER_AS_KERNEL',
    UseExistingKernel = 'DS_INTERNAL.USE_EXISTING_KERNEL',
    SwitchToInterpreterAsKernel = 'DS_INTERNAL.SWITCH_TO_INTERPRETER_AS_KERNEL',
    SwitchToExistingKernel = 'DS_INTERNAL.SWITCH_TO_EXISTING_KERNEL',
    SelfCertsMessageEnabled = 'DATASCIENCE.SELFCERTSMESSAGEENABLED',
    SelfCertsMessageClose = 'DATASCIENCE.SELFCERTSMESSAGECLOSE',
    RemoteAddCode = 'DATASCIENCE.LIVESHARE.ADDCODE',
    RemoteReexecuteCode = 'DATASCIENCE.LIVESHARE.REEXECUTECODE',
    ShiftEnterBannerShown = 'DS_INTERNAL.SHIFTENTER_BANNER_SHOWN',
    EnableInteractiveShiftEnter = 'DATASCIENCE.ENABLE_INTERACTIVE_SHIFT_ENTER',
    DisableInteractiveShiftEnter = 'DATASCIENCE.DISABLE_INTERACTIVE_SHIFT_ENTER',
    ShowDataViewer = 'DATASCIENCE.SHOW_DATA_EXPLORER',
    RunFileInteractive = 'DATASCIENCE.RUN_FILE_INTERACTIVE',
    DebugFileInteractive = 'DATASCIENCE.DEBUG_FILE_INTERACTIVE',
    PandasNotInstalled = 'DS_INTERNAL.SHOW_DATA_NO_PANDAS',
    PandasTooOld = 'DS_INTERNAL.SHOW_DATA_PANDAS_TOO_OLD',
    DataScienceSettings = 'DS_INTERNAL.SETTINGS',
    VariableExplorerToggled = 'DATASCIENCE.VARIABLE_EXPLORER_TOGGLE',
    VariableExplorerVariableCount = 'DS_INTERNAL.VARIABLE_EXPLORER_VARIABLE_COUNT',
    AddCellBelow = 'DATASCIENCE.ADD_CELL_BELOW',
    GetPasswordAttempt = 'DATASCIENCE.GET_PASSWORD_ATTEMPT',
    GetPasswordFailure = 'DS_INTERNAL.GET_PASSWORD_FAILURE',
    GetPasswordSuccess = 'DS_INTERNAL.GET_PASSWORD_SUCCESS',
    OpenPlotViewer = 'DATASCIENCE.OPEN_PLOT_VIEWER',
    DebugCurrentCell = 'DATASCIENCE.DEBUG_CURRENT_CELL',
    CodeLensAverageAcquisitionTime = 'DS_INTERNAL.CODE_LENS_ACQ_TIME',
    FindJupyterCommand = 'DS_INTERNAL.FIND_JUPYTER_COMMAND',
    /**
     * Telemetry sent when user selects an interpreter to be used for starting of Jupyter server.
     */
    SelectJupyterInterpreter = 'DS_INTERNAL.SELECT_JUPYTER_INTERPRETER',
    /**
     * User used command to select an intrepreter for the jupyter server.
     */
    SelectJupyterInterpreterCommand = 'DATASCIENCE.SELECT_JUPYTER_INTERPRETER_Command',
    StartJupyterProcess = 'DS_INTERNAL.START_JUPYTER_PROCESS',
    WaitForIdleJupyter = 'DS_INTERNAL.WAIT_FOR_IDLE_JUPYTER',
    HiddenCellTime = 'DS_INTERNAL.HIDDEN_EXECUTION_TIME',
    RestartJupyterTime = 'DS_INTERNAL.RESTART_JUPYTER_TIME',
    InterruptJupyterTime = 'DS_INTERNAL.INTERRUPT_JUPYTER_TIME',
    ExecuteCell = 'DATASCIENCE.EXECUTE_CELL_TIME',
    ExecuteCellPerceivedCold = 'DS_INTERNAL.EXECUTE_CELL_PERCEIVED_COLD',
    ExecuteCellPerceivedWarm = 'DS_INTERNAL.EXECUTE_CELL_PERCEIVED_WARM',
    PerceivedJupyterStartupNotebook = 'DS_INTERNAL.PERCEIVED_JUPYTER_STARTUP_NOTEBOOK',
    StartExecuteNotebookCellPerceivedCold = 'DS_INTERNAL.START_EXECUTE_NOTEBOOK_CELL_PERCEIVED_COLD',
    WebviewStartup = 'DS_INTERNAL.WEBVIEW_STARTUP',
    VariableExplorerFetchTime = 'DS_INTERNAL.VARIABLE_EXPLORER_FETCH_TIME',
    WebviewStyleUpdate = 'DS_INTERNAL.WEBVIEW_STYLE_UPDATE',
    WebviewMonacoStyleUpdate = 'DS_INTERNAL.WEBVIEW_MONACO_STYLE_UPDATE',
    FindJupyterKernelSpec = 'DS_INTERNAL.FIND_JUPYTER_KERNEL_SPEC',
    HashedCellOutputMimeType = 'DS_INTERNAL.HASHED_OUTPUT_MIME_TYPE',
    HashedCellOutputMimeTypePerf = 'DS_INTERNAL.HASHED_OUTPUT_MIME_TYPE_PERF',
    HashedNotebookCellOutputMimeTypePerf = 'DS_INTERNAL.HASHED_NOTEBOOK_OUTPUT_MIME_TYPE_PERF',
    JupyterInstalledButNotKernelSpecModule = 'DS_INTERNAL.JUPYTER_INTALLED_BUT_NO_KERNELSPEC_MODULE',
    DebugpyPromptToInstall = 'DATASCIENCE.DEBUGPY_PROMPT_TO_INSTALL',
    DebugpySuccessfullyInstalled = 'DATASCIENCE.DEBUGPY_SUCCESSFULLY_INSTALLED',
    DebugpyInstallFailed = 'DATASCIENCE.DEBUGPY_INSTALL_FAILED',
    DebugpyInstallCancelled = 'DATASCIENCE.DEBUGPY_INSTALL_CANCELLED',
    ScrolledToCell = 'DATASCIENCE.SCROLLED_TO_CELL',
    ExecuteNativeCell = 'DATASCIENCE.NATIVE.EXECUTE_NATIVE_CELL',
    CreateNewNotebook = 'DATASCIENCE.NATIVE.CREATE_NEW_NOTEBOOK',
    DebugStepOver = 'DATASCIENCE.DEBUG_STEP_OVER',
    DebugContinue = 'DATASCIENCE.DEBUG_CONTINUE',
    DebugStop = 'DATASCIENCE.DEBUG_STOP',
    OpenNotebook = 'DATASCIENCE.NATIVE.OPEN_NOTEBOOK',
    OpenNotebookAll = 'DATASCIENCE.NATIVE.OPEN_NOTEBOOK_ALL',
    ConvertToPythonFile = 'DATASCIENCE.NATIVE.CONVERT_NOTEBOOK_TO_PYTHON',
    NotebookWorkspaceCount = 'DS_INTERNAL.NATIVE.WORKSPACE_NOTEBOOK_COUNT',
    NotebookRunCount = 'DS_INTERNAL.NATIVE.NOTEBOOK_RUN_COUNT',
    NotebookOpenCount = 'DS_INTERNAL.NATIVE.NOTEBOOK_OPEN_COUNT',
    NotebookOpenTime = 'DS_INTERNAL.NATIVE.NOTEBOOK_OPEN_TIME',
    SessionIdleTimeout = 'DS_INTERNAL.JUPYTER_IDLE_TIMEOUT',
    JupyterStartTimeout = 'DS_INTERNAL.JUPYTER_START_TIMEOUT',
    JupyterNotInstalledErrorShown = 'DATASCIENCE.JUPYTER_NOT_INSTALLED_ERROR_SHOWN',
    JupyterCommandSearch = 'DATASCIENCE.JUPYTER_COMMAND_SEARCH',
    RegisterInterpreterAsKernel = 'DS_INTERNAL.JUPYTER_REGISTER_INTERPRETER_AS_KERNEL',
    UserInstalledJupyter = 'DATASCIENCE.USER_INSTALLED_JUPYTER',
    UserInstalledPandas = 'DATASCIENCE.USER_INSTALLED_PANDAS',
    UserDidNotInstallJupyter = 'DATASCIENCE.USER_DID_NOT_INSTALL_JUPYTER',
    UserDidNotInstallPandas = 'DATASCIENCE.USER_DID_NOT_INSTALL_PANDAS',
    OpenedInteractiveWindow = 'DATASCIENCE.OPENED_INTERACTIVE',
    OpenNotebookFailure = 'DS_INTERNAL.NATIVE.OPEN_NOTEBOOK_FAILURE',
    FindKernelForLocalConnection = 'DS_INTERNAL.FIND_KERNEL_FOR_LOCAL_CONNECTION',
    CompletionTimeFromLS = 'DS_INTERNAL.COMPLETION_TIME_FROM_LS',
    CompletionTimeFromJupyter = 'DS_INTERNAL.COMPLETION_TIME_FROM_JUPYTER',
    NotebookLanguage = 'DATASCIENCE.NOTEBOOK_LANGUAGE',
    KernelSpecNotFound = 'DS_INTERNAL.KERNEL_SPEC_NOT_FOUND',
    KernelRegisterFailed = 'DS_INTERNAL.KERNEL_REGISTER_FAILED',
    KernelEnumeration = 'DS_INTERNAL.KERNEL_ENUMERATION',
    KernelLauncherPerf = 'DS_INTERNAL.KERNEL_LAUNCHER_PERF',
    KernelFinderPerf = 'DS_INTERNAL.KERNEL_FINDER_PERF',
    JupyterInstallFailed = 'DS_INTERNAL.JUPYTER_INSTALL_FAILED',
    UserInstalledModule = 'DATASCIENCE.USER_INSTALLED_MODULE',
    JupyterCommandLineNonDefault = 'DS_INTERNAL.JUPYTER_CUSTOM_COMMAND_LINE',
    NewFileForInteractiveWindow = 'DS_INTERNAL.NEW_FILE_USED_IN_INTERACTIVE',
    KernelInvalid = 'DS_INTERNAL.INVALID_KERNEL_USED',
    GatherIsInstalled = 'DS_INTERNAL.GATHER_IS_INSTALLED',
    GatherCompleted = 'DATASCIENCE.GATHER_COMPLETED',
    GatherStats = 'DS_INTERNAL.GATHER_STATS',
    GatherException = 'DS_INTERNAL.GATHER_EXCEPTION',
    GatheredNotebookSaved = 'DATASCIENCE.GATHERED_NOTEBOOK_SAVED',
    GatherQualityReport = 'DS_INTERNAL.GATHER_QUALITY_REPORT',
    ZMQSupported = 'DS_INTERNAL.ZMQ_NATIVE_BINARIES_LOADING',
    ZMQNotSupported = 'DS_INTERNAL.ZMQ_NATIVE_BINARIES_NOT_LOADING',
    IPyWidgetLoadSuccess = 'DS_INTERNAL.IPYWIDGET_LOAD_SUCCESS',
    IPyWidgetLoadFailure = 'DS_INTERNAL.IPYWIDGET_LOAD_FAILURE',
    IPyWidgetWidgetVersionNotSupportedLoadFailure = 'DS_INTERNAL.IPYWIDGET_WIDGET_VERSION_NOT_SUPPORTED_LOAD_FAILURE',
    IPyWidgetLoadDisabled = 'DS_INTERNAL.IPYWIDGET_LOAD_DISABLED',
    HashedIPyWidgetNameUsed = 'DS_INTERNAL.IPYWIDGET_USED_BY_USER',
    VSCNotebookCellTranslationFailed = 'DS_INTERNAL.VSCNOTEBOOK_CELL_TRANSLATION_FAILED',
    HashedIPyWidgetNameDiscovered = 'DS_INTERNAL.IPYWIDGET_DISCOVERED',
    HashedIPyWidgetScriptDiscoveryError = 'DS_INTERNAL.IPYWIDGET_DISCOVERY_ERRORED',
    DiscoverIPyWidgetNamesLocalPerf = 'DS_INTERNAL.IPYWIDGET_TEST_AVAILABILITY_ON_LOCAL',
    DiscoverIPyWidgetNamesCDNPerf = 'DS_INTERNAL.IPYWIDGET_TEST_AVAILABILITY_ON_CDN',
    IPyWidgetPromptToUseCDN = 'DS_INTERNAL.IPYWIDGET_PROMPT_TO_USE_CDN',
    IPyWidgetPromptToUseCDNSelection = 'DS_INTERNAL.IPYWIDGET_PROMPT_TO_USE_CDN_SELECTION',
    IPyWidgetOverhead = 'DS_INTERNAL.IPYWIDGET_OVERHEAD',
    IPyWidgetRenderFailure = 'DS_INTERNAL.IPYWIDGET_RENDER_FAILURE',
    IPyWidgetUnhandledMessage = 'DS_INTERNAL.IPYWIDGET_UNHANDLED_MESSAGE',
    RawKernelCreatingNotebook = 'DS_INTERNAL.RAWKERNEL_CREATING_NOTEBOOK',
    JupyterCreatingNotebook = 'DS_INTERNAL.JUPYTER_CREATING_NOTEBOOK',
    RawKernelSessionConnect = 'DS_INTERNAL.RAWKERNEL_SESSION_CONNECT',
    RawKernelStartRawSession = 'DS_INTERNAL.RAWKERNEL_START_RAW_SESSION',
    RawKernelSessionStartSuccess = 'DS_INTERNAL.RAWKERNEL_SESSION_START_SUCCESS',
    RawKernelSessionStartUserCancel = 'DS_INTERNAL.RAWKERNEL_SESSION_START_USER_CANCEL',
    RawKernelSessionStartTimeout = 'DS_INTERNAL.RAWKERNEL_SESSION_START_TIMEOUT',
    RawKernelSessionStartException = 'DS_INTERNAL.RAWKERNEL_SESSION_START_EXCEPTION',
    RawKernelProcessLaunch = 'DS_INTERNAL.RAWKERNEL_PROCESS_LAUNCH',
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
    StartPageOpenWorkspace = 'DATASCIENCE.STARTPAGE_OPEN_WORKSPACE',
    RunByLineStart = 'DATASCIENCE.RUN_BY_LINE',
    RunByLineStep = 'DATASCIENCE.RUN_BY_LINE_STEP',
    RunByLineStop = 'DATASCIENCE.RUN_BY_LINE_STOP',
    RunByLineVariableHover = 'DATASCIENCE.RUN_BY_LINE_VARIABLE_HOVER',
    TrustAllNotebooks = 'DATASCIENCE.TRUST_ALL_NOTEBOOKS',
    TrustNotebook = 'DATASCIENCE.TRUST_NOTEBOOK',
    DoNotTrustNotebook = 'DATASCIENCE.DO_NOT_TRUST_NOTEBOOK',
    NotebookTrustPromptShown = 'DATASCIENCE.NOTEBOOK_TRUST_PROMPT_SHOWN'
}

export namespace Commands {
    export const RunAllCells = 'python.datascience.runallcells';
    export const RunAllCellsAbove = 'python.datascience.runallcellsabove';
    export const RunCellAndAllBelow = 'python.datascience.runcellandallbelow';
    export const SetJupyterKernel = 'python.datascience.setKernel';
    export const SwitchJupyterKernel = 'python.datascience.switchKernel';
    export const RunAllCellsAbovePalette = 'python.datascience.runallcellsabove.palette';
    export const RunCellAndAllBelowPalette = 'python.datascience.runcurrentcellandallbelow.palette';
    export const RunToLine = 'python.datascience.runtoline';
    export const RunFromLine = 'python.datascience.runfromline';
    export const RunCell = 'python.datascience.runcell';
    export const RunCurrentCell = 'python.datascience.runcurrentcell';
    export const RunCurrentCellAdvance = 'python.datascience.runcurrentcelladvance';
    export const CreateNewInteractive = 'python.datascience.createnewinteractive';
    export const ImportNotebook = 'python.datascience.importnotebook';
    export const ImportNotebookFile = 'python.datascience.importnotebookfile';
    export const OpenNotebook = 'python.datascience.opennotebook';
    export const OpenNotebookInPreviewEditor = 'python.datascience.opennotebookInPreviewEditor';
    export const SelectJupyterURI = 'python.datascience.selectjupyteruri';
    export const SelectJupyterCommandLine = 'python.datascience.selectjupytercommandline';
    export const ExportFileAsNotebook = 'python.datascience.exportfileasnotebook';
    export const ExportFileAndOutputAsNotebook = 'python.datascience.exportfileandoutputasnotebook';
    export const UndoCells = 'python.datascience.undocells';
    export const RedoCells = 'python.datascience.redocells';
    export const RemoveAllCells = 'python.datascience.removeallcells';
    export const InterruptKernel = 'python.datascience.interruptkernel';
    export const RestartKernel = 'python.datascience.restartkernel';
    export const NotebookEditorUndoCells = 'python.datascience.notebookeditor.undocells';
    export const NotebookEditorRedoCells = 'python.datascience.notebookeditor.redocells';
    export const NotebookEditorRemoveAllCells = 'python.datascience.notebookeditor.removeallcells';
    export const NotebookEditorInterruptKernel = 'python.datascience.notebookeditor.interruptkernel';
    export const NotebookEditorRestartKernel = 'python.datascience.notebookeditor.restartkernel';
    export const NotebookEditorRunAllCells = 'python.datascience.notebookeditor.runallcells';
    export const NotebookEditorRunSelectedCell = 'python.datascience.notebookeditor.runselectedcell';
    export const NotebookEditorAddCellBelow = 'python.datascience.notebookeditor.addcellbelow';
    export const ExpandAllCells = 'python.datascience.expandallcells';
    export const CollapseAllCells = 'python.datascience.collapseallcells';
    export const ExportOutputAsNotebook = 'python.datascience.exportoutputasnotebook';
    export const ExecSelectionInInteractiveWindow = 'python.datascience.execSelectionInteractive';
    export const RunFileInInteractiveWindows = 'python.datascience.runFileInteractive';
    export const DebugFileInInteractiveWindows = 'python.datascience.debugFileInteractive';
    export const AddCellBelow = 'python.datascience.addcellbelow';
    export const DebugCurrentCellPalette = 'python.datascience.debugcurrentcell.palette';
    export const DebugCell = 'python.datascience.debugcell';
    export const DebugStepOver = 'python.datascience.debugstepover';
    export const DebugContinue = 'python.datascience.debugcontinue';
    export const DebugStop = 'python.datascience.debugstop';
    export const RunCurrentCellAndAddBelow = 'python.datascience.runcurrentcellandaddbelow';
    export const InsertCellBelowPosition = 'python.datascience.insertCellBelowPosition';
    export const InsertCellBelow = 'python.datascience.insertCellBelow';
    export const InsertCellAbove = 'python.datascience.insertCellAbove';
    export const DeleteCells = 'python.datascience.deleteCells';
    export const SelectCell = 'python.datascience.selectCell';
    export const SelectCellContents = 'python.datascience.selectCellContents';
    export const ExtendSelectionByCellAbove = 'python.datascience.extendSelectionByCellAbove';
    export const ExtendSelectionByCellBelow = 'python.datascience.extendSelectionByCellBelow';
    export const MoveCellsUp = 'python.datascience.moveCellsUp';
    export const MoveCellsDown = 'python.datascience.moveCellsDown';
    export const ChangeCellToMarkdown = 'python.datascience.changeCellToMarkdown';
    export const ChangeCellToCode = 'python.datascience.changeCellToCode';
    export const GotoNextCellInFile = 'python.datascience.gotoNextCellInFile';
    export const GotoPrevCellInFile = 'python.datascience.gotoPrevCellInFile';
    export const ScrollToCell = 'python.datascience.scrolltocell';
    export const CreateNewNotebook = 'python.datascience.createnewnotebook';
    export const ViewJupyterOutput = 'python.datascience.viewJupyterOutput';
    export const ExportAsPythonScript = 'python.datascience.exportAsPythonScript';
    export const ExportToHTML = 'python.datascience.exportToHTML';
    export const ExportToPDF = 'python.datascience.exportToPDF';
    export const Export = 'python.datascience.export';
    export const SaveNotebookNonCustomEditor = 'python.datascience.notebookeditor.save';
    export const SaveAsNotebookNonCustomEditor = 'python.datascience.notebookeditor.saveAs';
    export const OpenNotebookNonCustomEditor = 'python.datascience.notebookeditor.open';
    export const GatherQuality = 'python.datascience.gatherquality';
    export const LatestExtension = 'python.datascience.latestExtension';
    export const TrustNotebook = 'python.datascience.notebookeditor.trust';
    export const EnableLoadingWidgetsFrom3rdPartySource =
        'python.datascience.enableLoadingWidgetScriptsFromThirdPartySource';
    export const NotebookEditorExpandAllCells = 'python.datascience.notebookeditor.expandallcells';
    export const NotebookEditorCollapseAllCells = 'python.datascience.notebookeditor.collapseallcells';
}
