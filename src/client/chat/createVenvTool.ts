// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    CancellationToken,
    l10n,
    LanguageModelTextPart,
    LanguageModelTool,
    LanguageModelToolInvocationOptions,
    LanguageModelToolInvocationPrepareOptions,
    LanguageModelToolResult,
    PreparedToolInvocation,
} from 'vscode';

export interface IResourceReference {
    resourcePath?: string;
}

export class CreateVenvTool implements LanguageModelTool<IResourceReference> {
    public static get EnvironmnentCreated() {
        return CreateVenvTool._envCreated;
    }
    private static _envCreated = false;
    public static readonly toolName = 'configure_python_environment';
    constructor() // private readonly api: PythonExtension['environments'],
    // private readonly serviceContainer: IServiceContainer,
    {
        // this.terminalExecutionService = this.serviceContainer.get<TerminalCodeExecutionProvider>(
        //     ICodeExecutionService,
        //     'standard',
        // );
        // this.interpreterPicker = this.serviceContainer.get<IInterpreterQuickPick>(IInterpreterQuickPick);
        // this.terminalHelper = this.serviceContainer.get<ITerminalHelper>(ITerminalHelper);
    }
    /**
     * Invokes the tool to get the information about the Python environment.
     * @param options - The invocation options containing the file path.
     * @param token - The cancellation token.
     * @returns The result containing the information about the Python environment or an error message.
     */
    async invoke(
        _options: LanguageModelToolInvocationOptions<IResourceReference>,
        _token: CancellationToken,
    ): Promise<LanguageModelToolResult> {
        const errorMessage: string = `Successfully created a Python environment.`;
        return new LanguageModelToolResult([new LanguageModelTextPart(errorMessage)]);
    }

    async prepareInvocation?(
        _options: LanguageModelToolInvocationPrepareOptions<IResourceReference>,
        _token: CancellationToken,
    ): Promise<PreparedToolInvocation> {
        if (CreateVenvTool._envCreated) {
            return {};
        }
        return {
            confirmationMessages: {
                title: l10n.t('Create Virtual Python Environment?'),
                message: l10n.t('A Python virtual environment will be created in the current workspace.'),
            },
            invocationMessage: l10n.t('Creating Python virtual environment'),
        };
    }
}
