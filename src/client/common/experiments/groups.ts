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

export enum ShowFormatterExtensionPrompt {
    experiment = 'pythonPromptNewFormatterExt',
}
// Experiment to enable the new testing rewrite.
export enum EnableTestAdapterRewrite {
    experiment = 'pythonTestAdapter',
}
// Experiment to enable smart shift+enter, advance cursor.
export enum EnableREPLSmartSend {
    experiment = 'pythonREPLSmartSend',
}

// Experiment to recommend installing the tensorboard extension.
export enum RecommendTensobardExtension {
    experiment = 'pythonRecommendTensorboardExt',
}
