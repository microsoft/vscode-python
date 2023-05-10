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

export const PYTHON_NOTEBOOKS = [
    { scheme: 'vscode-notebook', language: PYTHON_LANGUAGE },
    { scheme: NotebookCellScheme, language: PYTHON_LANGUAGE },
    { scheme: InteractiveInputScheme, language: PYTHON_LANGUAGE },
];

export const PVSC_EXTENSION_ID = 'ms-python.python';
export const PYLANCE_EXTENSION_ID = 'ms-python.vscode-pylance';
export const JUPYTER_EXTENSION_ID = 'ms-toolsai.jupyter';
export const AppinsightsKey = '0c6ae279ed8443289764825290e4f9e2-1a736e7c-1324-4338-be46-fc2a58ae4d14-7255';

export type Channel = 'stable' | 'insiders';

export enum CommandSource {
    ui = 'ui',
    commandPalette = 'commandpalette',
}

export namespace Commands {
    export const ClearStorage = 'python.clearCacheAndReload';
    export const CreateNewFile = 'python.createNewFile';
    export const ClearWorkspaceInterpreter = 'python.clearWorkspaceInterpreter';
    export const Create_Environment = 'python.createEnvironment';
    export const Create_Environment_Button = 'python.createEnvironment-button';
    export const Create_Terminal = 'python.createTerminal';
    export const Debug_In_Terminal = 'python.debugInTerminal';
    export const Enable_Linter = 'python.enableLinting';
    export const Enable_SourceMap_Support = 'python.enableSourceMapSupport';
    export const Exec_In_Terminal = 'python.execInTerminal';
    export const Exec_In_Terminal_Icon = 'python.execInTerminal-icon';
    export const Exec_In_Separate_Terminal = 'python.execInNewTerminal';
    export const Exec_Selection_In_Django_Shell = 'python.execSelectionInDjangoShell';
    export const Exec_Selection_In_Terminal = 'python.execSelectionInTerminal';
    export const GetSelectedInterpreterPath = 'python.interpreterPath';
    export const InstallJupyter = 'python.installJupyter';
    export const InstallPython = 'python.installPython';
    export const InstallPythonOnLinux = 'python.installPythonOnLinux';
    export const InstallPythonOnMac = 'python.installPythonOnMac';
    export const LaunchTensorBoard = 'python.launchTensorBoard';
    export const PickLocalProcess = 'python.pickLocalProcess';
    export const RefreshTensorBoard = 'python.refreshTensorBoard';
    export const ReportIssue = 'python.reportIssue';
    export const Run_Linter = 'python.runLinting';
    export const Set_Interpreter = 'python.setInterpreter';
    export const Set_Linter = 'python.setLinter';
    export const Set_ShebangInterpreter = 'python.setShebangInterpreter';
    export const Sort_Imports = 'python.sortImports';
    export const Start_REPL = 'python.startREPL';
    export const Tests_Configure = 'python.configureTests';
    export const TriggerEnvironmentSelection = 'python.triggerEnvSelection';
    export const ViewOutput = 'python.viewOutput';
}

// Look at https://microsoft.github.io/vscode-codicons/dist/codicon.html for other Octicon icon ids
export namespace Octicons {
    export const Add = '$(add)';
    export const Test_Pass = '$(check)';
    export const Test_Fail = '$(alert)';
    export const Test_Error = '$(x)';
    export const Test_Skip = '$(circle-slash)';
    export const Downloading = '$(cloud-download)';
    export const Installing = '$(desktop-download)';
    export const Search_Stop = '$(search-stop)';
    export const Star = '$(star-full)';
    export const Gear = '$(gear)';
    export const Warning = '$(warning)';
    export const Error = '$(error)';
    export const Lightbulb = '$(lightbulb)';
}

/**
 * Look at https://code.visualstudio.com/api/references/icons-in-labels#icon-listing for ThemeIcon ids.
 * Using a theme icon is preferred over a custom icon as it gives product theme authors the possibility
 * to change the icons.
 */
export namespace ThemeIcons {
    export const Refresh = 'refresh';
    export const SpinningLoader = 'loading~spin';
}

export const DEFAULT_INTERPRETER_SETTING = 'python';

export const isCI = process.env.TRAVIS === 'true' || process.env.TF_BUILD !== undefined;

export function isTestExecution(): boolean {
    return process.env.VSC_PYTHON_CI_TEST === '1' || isUnitTestExecution();
}

/**
 * Whether we're running unit tests (*.unit.test.ts).
 * These tests have a special meaning, they run fast.
 * @export
 * @returns {boolean}
 */
export function isUnitTestExecution(): boolean {
    return process.env.VSC_PYTHON_UNIT_TEST === '1';
}

export const UseProposedApi = Symbol('USE_VSC_PROPOSED_API');

export * from '../constants';
