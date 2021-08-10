/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
export const PYTHON_LANGUAGE = 'python';
export const PYTHON_WARNINGS = 'PYTHONWARNINGS';

export const NotebookCellScheme = 'vscode-notebook-cell';
export const InteractiveInputScheme = 'vscode-interactive-input';
export const InteractiveScheme = 'vscode-interactive';
export const PYTHON = [
    { scheme: 'file', language: PYTHON_LANGUAGE },
    { scheme: 'untitled', language: PYTHON_LANGUAGE },
    { scheme: 'vscode-notebook', language: PYTHON_LANGUAGE },
    { scheme: NotebookCellScheme, language: PYTHON_LANGUAGE },
    { scheme: InteractiveInputScheme, language: PYTHON_LANGUAGE },
];

export const PVSC_EXTENSION_ID = 'ms-python.python';
export const CODE_RUNNER_EXTENSION_ID = 'formulahendry.code-runner';
export const PYLANCE_EXTENSION_ID = 'ms-python.vscode-pylance';
export const JUPYTER_EXTENSION_ID = 'ms-toolsai.jupyter';
export const AppinsightsKey = 'AIF-d9b70cd4-b9f9-4d70-929b-a071c400b217';

export type Channel = 'stable' | 'insiders';

export enum CommandSource {
    ui = 'ui',
    commandPalette = 'commandpalette',
}

export namespace Commands {
    export const Set_Interpreter = 'python.setInterpreter';
    export const Set_ShebangInterpreter = 'python.setShebangInterpreter';
    export const Exec_In_Terminal = 'python.execInTerminal';
    export const Exec_In_Terminal_Icon = 'python.execInTerminal-icon';
    export const Exec_Selection_In_Terminal = 'python.execSelectionInTerminal';
    export const Exec_Selection_In_Django_Shell = 'python.execSelectionInDjangoShell';
    export const Tests_Configure = 'python.configureTests';
    export const Test_Refresh = 'python.refreshTests';
    // `python.refreshingTests` is a dummy command just to show the spinning icon
    export const Test_Refreshing = 'python.refreshingTests';
    export const Test_Stop_Refreshing = 'python.stopRefreshingTests';
    export const Sort_Imports = 'python.sortImports';
    export const ViewOutput = 'python.viewOutput';
    export const Refactor_Extract_Variable = 'python.refactorExtractVariable';
    export const Refactor_Extract_Method = 'python.refactorExtractMethod';
    export const Build_Workspace_Symbols = 'python.buildWorkspaceSymbols';
    export const Start_REPL = 'python.startREPL';
    export const Create_Terminal = 'python.createTerminal';
    export const Set_Linter = 'python.setLinter';
    export const Enable_Linter = 'python.enableLinting';
    export const Run_Linter = 'python.runLinting';
    export const Enable_SourceMap_Support = 'python.enableSourceMapSupport';
    export const SwitchOffInsidersChannel = 'python.switchOffInsidersChannel';
    export const SwitchToInsidersDaily = 'python.switchToDailyChannel';
    export const SwitchToInsidersWeekly = 'python.switchToWeeklyChannel';
    export const PickLocalProcess = 'python.pickLocalProcess';
    export const GetSelectedInterpreterPath = 'python.interpreterPath';
    export const ClearStorage = 'python.clearPersistentStorage';
    export const ClearWorkspaceInterpreter = 'python.clearWorkspaceInterpreter';
    export const OpenStartPage = 'python.startPage.open';
    export const LaunchTensorBoard = 'python.launchTensorBoard';
    export const RefreshTensorBoard = 'python.refreshTensorBoard';
    export const ReportIssue = 'python.reportIssue';
}

// Look at https://microsoft.github.io/vscode-codicons/dist/codicon.html for other Octicon icon ids
export namespace Octicons {
    export const Test_Pass = '$(check)';
    export const Test_Fail = '$(alert)';
    export const Test_Error = '$(x)';
    export const Test_Skip = '$(circle-slash)';
    export const Downloading = '$(cloud-download)';
    export const Installing = '$(desktop-download)';
    export const Search_Stop = '$(search-stop)';
    export const Star = '$(star)';
}

export const DEFAULT_INTERPRETER_SETTING = 'python';

export const STANDARD_OUTPUT_CHANNEL = 'STANDARD_OUTPUT_CHANNEL';

export const isCI = process.env.TRAVIS === 'true' || process.env.TF_BUILD !== undefined;

export function isTestExecution(): boolean {
    return process.env.VSC_PYTHON_CI_TEST === '1' || isUnitTestExecution();
}

/**
 * Whether we're running unit tests (*.unit.test.ts).
 * These tests have a speacial meaning, they run fast.
 * @export
 * @returns {boolean}
 */
export function isUnitTestExecution(): boolean {
    return process.env.VSC_PYTHON_UNIT_TEST === '1';
}

// Temporary constant, used to indicate whether we're using custom editor api or not.
export const UseCustomEditorApi = Symbol('USE_CUSTOM_EDITOR');
export const UseProposedApi = Symbol('USE_VSC_PROPOSED_API');

export * from '../constants';
