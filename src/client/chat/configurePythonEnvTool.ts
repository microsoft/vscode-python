// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    lm,
    CancellationError,
    CancellationToken,
    l10n,
    LanguageModelTextPart,
    LanguageModelTool,
    LanguageModelToolInvocationOptions,
    LanguageModelToolInvocationPrepareOptions,
    LanguageModelToolResult,
    PreparedToolInvocation,
} from 'vscode';
import { PythonExtension } from '../api/types';
import { IServiceContainer } from '../ioc/types';
import { ICodeExecutionService } from '../terminals/types';
import { TerminalCodeExecutionProvider } from '../terminals/codeExecution/terminalCodeExecution';
import { getEnvironmentDetails, raceCancellationError } from './utils';
import { resolveFilePath } from './utils';
import { IInterpreterQuickPick } from '../interpreter/configuration/types';
import { ITerminalHelper } from '../common/terminal/types';
import { StopWatch } from '../common/utils/stopWatch';
import { sleep } from '../common/utils/async';
import { CreateVenvTool } from './createVenvTool';

export interface IResourceReference {
    resourcePath?: string;
}

export class ConfigurePythonEnvTool implements LanguageModelTool<IResourceReference> {
    public static get EnvironmentConfigured() {
        return ConfigurePythonEnvTool._environmentConfigured;
    }
    private static _environmentConfigured = false;
    private readonly terminalExecutionService: TerminalCodeExecutionProvider;
    private readonly interpreterPicker: IInterpreterQuickPick;
    private readonly terminalHelper: ITerminalHelper;
    public static readonly toolName = 'configure_python_environment';
    constructor(
        private readonly api: PythonExtension['environments'],
        private readonly serviceContainer: IServiceContainer,
    ) {
        this.terminalExecutionService = this.serviceContainer.get<TerminalCodeExecutionProvider>(
            ICodeExecutionService,
            'standard',
        );
        this.interpreterPicker = this.serviceContainer.get<IInterpreterQuickPick>(IInterpreterQuickPick);
        this.terminalHelper = this.serviceContainer.get<ITerminalHelper>(ITerminalHelper);
    }
    /**
     * Invokes the tool to get the information about the Python environment.
     * @param options - The invocation options containing the file path.
     * @param token - The cancellation token.
     * @returns The result containing the information about the Python environment or an error message.
     */
    async invoke(
        options: LanguageModelToolInvocationOptions<IResourceReference>,
        token: CancellationToken,
    ): Promise<LanguageModelToolResult> {
        const resourcePath = resolveFilePath(options.input.resourcePath);

        try {
            if (!ConfigurePythonEnvTool.EnvironmentConfigured) {
                // Try to create one.
                const result = await lm.invokeTool(CreateVenvTool.toolName, { resourcePath: options.input.resourcePath } as any, token);
                console.log('CreateVenvTool result:', result);
                const interpreterPath = await this.interpreterPicker.getInterpreterViaQuickPick(
                    resourcePath,
                    undefined,
                    {
                        showCreateEnvironment: true,
                    },
                );
                if (!interpreterPath) {
                    return new LanguageModelToolResult([
                        new LanguageModelTextPart('No Python Environment configured.'),
                    ]);
                }
                ConfigurePythonEnvTool._environmentConfigured = true;

                const stopWatch = new StopWatch();
                while (stopWatch.elapsedTime < 5_000) {
                    try {
                        await this.api.getActiveEnvironmentPath(resourcePath);
                    } catch {
                        await sleep(500);
                        continue;
                    }
                }
            }
            // environment
            const envPath = this.api.getActiveEnvironmentPath(resourcePath);
            const environment = await raceCancellationError(this.api.resolveEnvironment(envPath), token);
            if (!environment || !environment.version) {
                throw new Error('No environment found for the provided resource path: ' + resourcePath?.fsPath);
            }
            const message = await getEnvironmentDetails(
                resourcePath,
                this.api,
                this.terminalExecutionService,
                this.terminalHelper,
                undefined,
                token,
            );
            return new LanguageModelToolResult([new LanguageModelTextPart(message)]);
        } catch (error) {
            if (error instanceof CancellationError) {
                throw error;
            }
            const errorMessage: string = `An error occurred while fetching environment information: ${error}`;
            return new LanguageModelToolResult([new LanguageModelTextPart(errorMessage)]);
        }
    }

    async prepareInvocation?(
        _options: LanguageModelToolInvocationPrepareOptions<IResourceReference>,
        _token: CancellationToken,
    ): Promise<PreparedToolInvocation> {
        if (ConfigurePythonEnvTool._environmentConfigured) {
            return {};
        }
        return {
            confirmationMessages: {
                title: l10n.t('Configure your Python Environment?'),
                message: l10n.t(
                    'You can either select a Python environment or create a new Environment.  \nThe latter being the recommended option.',
                ),
            },
            invocationMessage: l10n.t('Configuring Python environment'),
        };
    }
}
