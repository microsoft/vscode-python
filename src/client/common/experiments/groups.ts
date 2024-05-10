// Experiment to check whether to show "Extension Survey prompt" or not.
export enum ShowExtensionSurveyPrompt {
    experiment = 'pythonSurveyNotification',
}

export enum ShowToolsExtensionPrompt {
    experiment = 'pythonPromptNewToolsExt',
}

export enum TerminalEnvVarActivation {
    experiment = 'pythonTerminalEnvVarActivation',
}

export enum DiscoveryUsingWorkers {
    experiment = 'pythonDiscoveryUsingWorkers',
}

// Experiment to enable the new testing rewrite.
export enum EnableTestAdapterRewrite {
    experiment = 'pythonTestAdapter',
}

// Experiment to recommend installing the tensorboard extension.
export enum RecommendTensobardExtension {
    experiment = 'pythonRecommendTensorboardExt',
}

// Experiment to enable triggering venv creation when users install with `pip`
// in a global environment
export enum CreateEnvOnPipInstallTrigger {
    experiment = 'pythonCreateEnvOnPipInstall',
}

// Experiment to enable running Python REPL using IW.
export enum EnableRunREPL {
    experiment = 'pythonRunREPL',
}
