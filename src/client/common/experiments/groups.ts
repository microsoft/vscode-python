// Experiment to check whether to always display the test explorer.
export enum AlwaysDisplayTestExplorerGroups {
    control = 'AlwaysDisplayTestExplorer - control',
    experiment = 'AlwaysDisplayTestExplorer - experiment'
}

// Experiment to check whether to show "Extension Survey prompt" or not.
export enum ShowExtensionSurveyPrompt {
    control = 'ShowExtensionSurveyPrompt - control',
    enabled = 'ShowExtensionSurveyPrompt - enabled'
}

// Experiment to check whether to enable re-load for web apps while debugging.
export enum WebAppReload {
    control = 'Reload - control',
    experiment = 'Reload - experiment'
}

// Experiment to use a local ZMQ kernel connection as opposed to starting a Jupyter server locally
export enum LocalZMQKernel {
    control = 'LocalZMQKernel - control',
    experiment = 'LocalZMQKernel - experiment'
}

// Experiment for supporting run by line in data science notebooks
export enum RunByLine {
    control = 'RunByLine - control',
    experiment = 'RunByLine - experiment'
}

/**
 * Experiment to check whether to to use a terminal to generate the environment variables of activated environments.
 *
 * @export
 * @enum {number}
 */
export enum UseTerminalToGetActivatedEnvVars {
    control = 'UseTerminalToGetActivatedEnvVars - control',
    experiment = 'UseTerminalToGetActivatedEnvVars - experiment'
}

// Dummy experiment added to validate metrics of A/B testing
export enum ValidateABTesting {
    control = 'AA_testing - control',
    experiment = 'AA_testing - experiment'
}

// Collect language server request timings.
export enum CollectLSRequestTiming {
    control = 'CollectLSRequestTiming - control',
    experiment = 'CollectLSRequestTiming - experiment'
}

// Collect Node language server request timings.
export enum CollectNodeLSRequestTiming {
    control = 'CollectNodeLSRequestTiming - control',
    experiment = 'CollectNodeLSRequestTiming - experiment'
}

// Determine if ipywidgets is enabled or not
export enum EnableIPyWidgets {
    control = 'EnableIPyWidgets - control',
    experiment = 'EnableIPyWidgets - experiment'
}

/*
 * Experiment to check whether the extension should deprecate `python.pythonPath` setting
 */
export enum DeprecatePythonPath {
    control = 'DeprecatePythonPath - control',
    experiment = 'DeprecatePythonPath - experiment'
}

/*
 * Experiment to turn on custom editor or VS Code Native Notebook API support.
 */
export enum NotebookEditorSupport {
    control = 'CustomEditorSupport - control',
    customEditorExperiment = 'CustomEditorSupport - experiment',
    nativeNotebookExperiment = 'NativeNotebook - experiment'
}

// Experiment to turn on the start page
export enum EnableStartPage {
    experiment = 'EnableStartPage'
}

// Experiment to remove the Kernel/Server Tooblar in the Interactive Window when running a local Jupyter Server.
// It doesn't make sense to have it there, the user can already change the kernel
// by changing the python interpreter on the status bar.
export enum RemoveKernelToolbarInInteractiveWindow {
    experiment = 'RemoveKernelToolbarInInteractiveWindow'
}

// Experiment to turn on trusted notebooks checks
export enum EnableTrustedNotebooks {
    experiment = 'EnableTrustedNotebooks'
}

// Experiment to offer switch to Pylance language server
export enum TryPylance {
    experiment = 'tryPylance'
}
