// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
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
import { IProcessServiceFactory, IPythonExecutionFactory } from '../common/process/types';
import { getEnvironmentDetails, getToolResponseIfNotebook, raceCancellationError } from './utils';
import { resolveFilePath } from './utils';
import { getPythonPackagesResponse } from './listPackagesTool';
import { ITerminalHelper } from '../common/terminal/types';

export interface IResourceReference {
    resourcePath?: string;
}

export class GetEnvironmentInfoTool implements LanguageModelTool<IResourceReference> {
    private readonly terminalExecutionService: TerminalCodeExecutionProvider;
    private readonly pythonExecFactory: IPythonExecutionFactory;
    private readonly processServiceFactory: IProcessServiceFactory;
    private readonly terminalHelper: ITerminalHelper;
    public static readonly toolName = 'get_python_environment_details';
    constructor(
        private readonly api: PythonExtension['environments'],
        private readonly serviceContainer: IServiceContainer,
    ) {
        this.terminalExecutionService = this.serviceContainer.get<TerminalCodeExecutionProvider>(
            ICodeExecutionService,
            'standard',
        );
        this.pythonExecFactory = this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        this.processServiceFactory = this.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
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
        const notebookResponse = getToolResponseIfNotebook(resourcePath);
        if (notebookResponse) {
            return notebookResponse;
        }

        try {
            // environment
            const envPath = this.api.getActiveEnvironmentPath(resourcePath);
            const environment = await raceCancellationError(this.api.resolveEnvironment(envPath), token);
            if (!environment || !environment.version) {
                throw new Error('No environment found for the provided resource path: ' + resourcePath?.fsPath);
            }
            const packages = await getPythonPackagesResponse(
                environment,
                this.pythonExecFactory,
                this.processServiceFactory,
                resourcePath,
                token,
            );

            const message = await getEnvironmentDetails(
                resourcePath,
                this.api,
                this.terminalExecutionService,
                this.terminalHelper,
                packages,
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
        options: LanguageModelToolInvocationPrepareOptions<IResourceReference>,
        _token: CancellationToken,
    ): Promise<PreparedToolInvocation> {
        const resourcePath = resolveFilePath(options.input.resourcePath);
        if (getToolResponseIfNotebook(resourcePath)) {
            return {};
        }

        return {
            invocationMessage: l10n.t('Fetching Python environment information'),
        };
    }
}
