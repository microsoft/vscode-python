import { DocumentFilter } from 'vscode';

export const PYTHON_LANGUAGE = 'python';

export const JUPYTER_LANGUAGE = 'jupyter';

export const PYTHON: DocumentFilter[] = [
    { scheme: 'file', language: PYTHON_LANGUAGE },
    { scheme: 'untitled', language: PYTHON_LANGUAGE }
];
export const PYTHON_ALLFILES = [{ language: PYTHON_LANGUAGE }];

export const PVSC_EXTENSION_ID = 'ms-python.python';
export const CODE_RUNNER_EXTENSION_ID = 'formulahendry.code-runner';
export const AppinsightsKey = 'AIF-d9b70cd4-b9f9-4d70-929b-a071c400b217';

export namespace Commands {
    export const Set_Interpreter = 'python.setInterpreter';
    export const Set_ShebangInterpreter = 'python.setShebangInterpreter';
    export const Exec_In_Terminal = 'python.execInTerminal';
    export const Exec_In_Terminal_Icon = 'python.execInTerminal-icon';
    export const Exec_Selection_In_Terminal = 'python.execSelectionInTerminal';
    export const Exec_Selection_In_Django_Shell = 'python.execSelectionInDjangoShell';
    export const Tests_View_UI = 'python.viewTestUI';
    export const Tests_Picker_UI = 'python.selectTestToRun';
    export const Tests_Picker_UI_Debug = 'python.selectTestToDebug';
    export const Tests_Configure = 'python.configureTests';
    export const Tests_Discover = 'python.discoverTests';
    export const Tests_Discovering = 'python.discoveringTests';
    export const Tests_Run_Failed = 'python.runFailedTests';
    export const Sort_Imports = 'python.sortImports';
    export const Tests_Run = 'python.runtests';
    export const Tests_Run_Parametrized = 'python.runParametrizedTests';
    export const Tests_Debug = 'python.debugtests';
    export const Tests_Ask_To_Stop_Test = 'python.askToStopTests';
    export const Tests_Ask_To_Stop_Discovery = 'python.askToStopTestDiscovery';
    export const Tests_Stop = 'python.stopTests';
    export const Test_Reveal_Test_Item = 'python.revealTestItem';
    export const ViewOutput = 'python.viewOutput';
    export const Tests_ViewOutput = 'python.viewTestOutput';
    export const Tests_Select_And_Run_Method = 'python.selectAndRunTestMethod';
    export const Tests_Select_And_Debug_Method = 'python.selectAndDebugTestMethod';
    export const Tests_Select_And_Run_File = 'python.selectAndRunTestFile';
    export const Tests_Run_Current_File = 'python.runCurrentTestFile';
    export const Refactor_Extract_Variable = 'python.refactorExtractVariable';
    export const Refactor_Extract_Method = 'python.refactorExtractMethod';
    export const Build_Workspace_Symbols = 'python.buildWorkspaceSymbols';
    export const Start_REPL = 'python.startREPL';
    export const Create_Terminal = 'python.createTerminal';
    export const Set_Linter = 'python.setLinter';
    export const Enable_Linter = 'python.enableLinting';
    export const Run_Linter = 'python.runLinting';
    export const Enable_SourceMap_Support = 'python.enableSourceMapSupport';
    export const navigateToTestFunction = 'navigateToTestFunction';
    export const navigateToTestSuite = 'navigateToTestSuite';
    export const navigateToTestFile = 'navigateToTestFile';
    export const openTestNodeInEditor = 'python.openTestNodeInEditor';
    export const runTestNode = 'python.runTestNode';
    export const debugTestNode = 'python.debugTestNode';
    export const SwitchOffInsidersChannel = 'python.switchOffInsidersChannel';
    export const SwitchToInsidersDaily = 'python.switchToDailyChannel';
    export const SwitchToInsidersWeekly = 'python.switchToWeeklyChannel';
    export const PickLocalProcess = 'python.pickLocalProcess';
}
export namespace Octicons {
    export const Test_Pass = '$(check)';
    export const Test_Fail = '$(alert)';
    export const Test_Error = '$(x)';
    export const Test_Skip = '$(circle-slash)';
}

export const Button_Text_Tests_View_Output = 'View Output';

export namespace Text {
    export const CodeLensRunUnitTest = 'Run Test';
    export const CodeLensDebugUnitTest = 'Debug Test';
}
export namespace Delays {
    // Max time to wait before aborting the generation of code lenses for unit tests
    export const MaxUnitTestCodeLensDelay = 5000;
}

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

export * from '../constants';
