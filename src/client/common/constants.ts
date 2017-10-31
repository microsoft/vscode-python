
export const PythonLanguage = { language: 'python' };

export namespace Commands {
    export const Set_Interpreter = 'python.setInterpreter';
    export const Exec_In_Terminal = 'python.execInTerminal';
    export const Exec_Selection_In_Terminal = 'python.execSelectionInTerminal';
    export const Exec_Selection_In_Django_Shell = 'python.execSelectionInDjangoShell';
    export const Tests_View_UI = 'python.viewTestUI';
    export const Tests_Picker_UI = 'python.selectTestToRun';
    export const Tests_Picker_UI_Debug = 'python.selectTestToDebug';
    export const Tests_Discover = 'python.discoverTests';
    export const Tests_Run_Failed = 'python.runFailedTests';
    export const Sort_Imports = 'python.sortImports';
    export const Tests_Run = 'python.runtests';
    export const Tests_Debug = 'python.debugtests';
    export const Tests_Ask_To_Stop_Test = 'python.askToStopUnitTests';
    export const Tests_Ask_To_Stop_Discovery = 'python.askToStopUnitTestDiscovery';
    export const Tests_Stop = 'python.stopUnitTests';
    export const Tests_ViewOutput = 'python.viewTestOutput';
    export const Tests_Select_And_Run_Method = 'python.selectAndRunTestMethod';
    export const Tests_Select_And_Debug_Method = 'python.selectAndDebugTestMethod';
    export const Tests_Select_And_Run_File = 'python.selectAndRunTestFile';
    export const Tests_Run_Current_File = 'python.runCurrentTestFile';
    export const Refactor_Extract_Variable = 'python.refactorExtractVariable';
    export const Refaactor_Extract_Method = 'python.refactorExtractMethod';
    export const Update_SparkLibrary = 'python.updateSparkLibrary';
    export const Build_Workspace_Symbols = 'python.buildWorkspaceSymbols';
    export const Start_REPL = 'python.startREPL';
    export namespace Jupyter {
        export const Get_All_KernelSpecs_For_Language = 'jupyter.getAllKernelSpecsForLanguage';
        export const Get_All_KernelSpecs = 'jupyter.getAllKernelSpecs';
        export const Select_Kernel = 'jupyter.selectKernel';
        export const Kernel_Options = 'jupyter.kernelOptions';
        export const StartKernelForKernelSpeck = 'jupyter.sartKernelForKernelSpecs';
        export const ExecuteRangeInKernel = 'jupyter.execRangeInKernel';
        export const ExecuteSelectionOrLineInKernel = 'jupyter.runSelectionLine';
        export namespace Cell {
            export const ExecuteCurrentCell = 'jupyter.execCurrentCell';
            export const ExecuteCurrentCellAndAdvance = 'jupyter.execCurrentCellAndAdvance';
            export const AdcanceToCell = 'jupyter.advanceToNextCell';
            export const DisplayCellMenu = 'jupyter.displayCellMenu';
            export const GoToPreviousCell = 'jupyter.gotToPreviousCell';
            export const GoToNextCell = 'jupyter.gotToNextCell';
        }
        export namespace Kernel {
            export const Kernel_Interrupt = 'jupyter.kernelInterrupt';
            export const Kernel_Restart = 'jupyter.kernelRestart';
            export const Kernel_Shut_Down = 'jupyter.kernelShutDown';
            export const Kernel_Details = 'jupyter.kernelDetails';
        }
    }
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

export namespace LinterErrors {
    export namespace pylint {
        export const InvalidSyntax = 'E0001';
    }
    export namespace prospector {
        export const InvalidSyntax = 'F999';
    }
    export namespace flake8 {
        export const InvalidSyntax = 'E999';
    }
}

export namespace Documentation {
    export const Home = '/docs/python-path/';
    export namespace Jupyter {
        export const GettingStarted = '/docs/jupyter_getting-started/';
        export const Examples = '/docs/jupyter_examples/';
        export const Setup = '/docs/jupyter_prerequisites/';
        export const VersionIncompatiblity = '/docs/troubleshooting_jupyter/#Incompatible-dependencies';
    }
    export namespace Formatting {
        export const FormatOnSave = '/docs/formatting/';
    }
    export namespace Workspace {
        export const Home = '/docs/workspaceSymbols/';
        export const InstallOnWindows = '/docs/workspaceSymbols/#Install-Windows';
    }
}
