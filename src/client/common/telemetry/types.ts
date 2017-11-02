export type EditorLoadTelemetry = {
    condaVersion: string;
};
export type FormatTelemetry = {
    tool: 'autoppep8' | 'yapf';
    hasCustomArgs: boolean;
    formatSelection: boolean;
};
export type LintingTelemetry = {
    tool: 'flake8' | 'mypy' | 'pep8' | 'prospector' | 'pydocstyle' | 'pylama' | 'pylint';
    hasCustomArgs: boolean;
    trigger: 'save' | 'auto';
    executableSpecified: boolean;
};
export type PythonInterpreterTelemetry = {
    trigger: 'ui' | 'shebang' | 'load';
    failed: boolean;
    version: string;
    pipVersion: string;
};
export type CodeExecutionTelemetry = {
    scope: 'file' | 'selection';
};
export type DebuggerTelemetry = {
    trigger: 'launch' | 'attach'
    console?: 'none' | 'integratedTerminal' | 'externalTerminal';
    debugOptions?: string;
    pyspark?: boolean;
    hasEnvVars?: boolean;
};
export type TelemetryProperties = FormatTelemetry | LintingTelemetry | EditorLoadTelemetry | PythonInterpreterTelemetry | CodeExecutionTelemetry;
