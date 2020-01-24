export const LSControl = 'LS - control';
export const LSEnabled = 'LS - enabled';

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

// Experiment to check whether the extension should use the new VS Code debug adapter API.
export enum DebugAdapterDescriptorFactory {
    control = 'DebugAdapterFactory - control',
    experiment = 'DebugAdapterFactory - experiment'
}

// Experiment to check whether the ptvsd launcher should use pre-installed ptvsd wheels for debugging.
export enum DebugAdapterNewPtvsd {
    control = 'PtvsdWheels37 - control',
    experiment = 'PtvsdWheels37 - experiment'
}

// Experiment to check whether to enable re-load for web apps while debugging.
export enum WebAppReload {
    control = 'Reload - control',
    experiment = 'Reload - experiment'
}

/**
 * Slow roll out, to test use of local web server for serving content in the Native Notebook editor.
 *
 * @export
 * @enum {string}
 */
export enum WebHostNotebook {
    control = 'WebHostNotebook - control',
    experiment = 'WebHostNotebook - experiment'
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
