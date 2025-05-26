// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    CancellationToken,
    LanguageModelTool,
    LanguageModelToolInvocationOptions,
    LanguageModelToolInvocationPrepareOptions,
    LanguageModelToolResult,
    PreparedToolInvocation,
    Uri,
    workspace,
    lm,
} from 'vscode';
import { PythonExtension } from '../api/types';
import { IServiceContainer } from '../ioc/types';
import { ICodeExecutionService } from '../terminals/types';
import { TerminalCodeExecutionProvider } from '../terminals/codeExecution/terminalCodeExecution';
import {
    getEnvDetailsForResponse,
    getToolResponseIfNotebook,
    IResourceReference,
    isCancellationError,
    raceCancellationError,
} from './utils';
import { resolveFilePath } from './utils';
import { ITerminalHelper } from '../common/terminal/types';
import { IRecommendedEnvironmentService } from '../interpreter/configuration/types';
import { CreateVirtualEnvTool } from './createVirtualEnvTool';
import { SelectPythonEnvTool } from './selectEnvTool';

export class ConfigurePythonEnvTool implements LanguageModelTool<IResourceReference> {
    private readonly terminalExecutionService: TerminalCodeExecutionProvider;
    private readonly terminalHelper: ITerminalHelper;
    private readonly recommendedEnvService: IRecommendedEnvironmentService;
    public static readonly toolName = 'configure_python_environment';
    constructor(
        private readonly api: PythonExtension['environments'],
        private readonly serviceContainer: IServiceContainer,
        private readonly createVirtualEnvTool: CreateVirtualEnvTool,
    ) {
        this.terminalExecutionService = this.serviceContainer.get<TerminalCodeExecutionProvider>(
            ICodeExecutionService,
            'standard',
        );
        this.terminalHelper = this.serviceContainer.get<ITerminalHelper>(ITerminalHelper);
        this.recommendedEnvService = this.serviceContainer.get<IRecommendedEnvironmentService>(
            IRecommendedEnvironmentService,
        );
    }

    async invoke(
        options: LanguageModelToolInvocationOptions<IResourceReference>,
        token: CancellationToken,
    ): Promise<LanguageModelToolResult> {
        const resource = resolveFilePath(options.input.resourcePath);
        const notebookResponse = getToolResponseIfNotebook(resource);
        if (notebookResponse) {
            return notebookResponse;
        }

        const workspaceSpecificEnv = await raceCancellationError(
            this.hasAlreadyGotAWorkspaceSpecificEnvironment(resource),
            token,
        );

        if (workspaceSpecificEnv) {
            return getEnvDetailsForResponse(
                workspaceSpecificEnv,
                this.api,
                this.terminalExecutionService,
                this.terminalHelper,
                resource,
                token,
            );
        }

        let reason: 'cancelled' | undefined;
        if (
            await this.createVirtualEnvTool.canCreateNewVirtualEnv(resolveFilePath(options.input.resourcePath), token)
        ) {
            reason = 'cancelled';
            try {
                return await lm.invokeTool(CreateVirtualEnvTool.toolName, options, token);
            } catch (ex) {
                // If the user cancelled the tool, then we should not invoke the select env tool.
                if (!isCancellationError(ex)) {
                    throw ex;
                }
            }
        }

        return lm.invokeTool(SelectPythonEnvTool.toolName, { ...options, input: { ...options.input, reason } }, token);
    }

    async prepareInvocation?(
        _options: LanguageModelToolInvocationPrepareOptions<IResourceReference>,
        _token: CancellationToken,
    ): Promise<PreparedToolInvocation> {
        return {
            invocationMessage: 'Configuring a Python Environment',
        };
    }

    async hasAlreadyGotAWorkspaceSpecificEnvironment(resource: Uri | undefined) {
        const recommededEnv = await this.recommendedEnvService.getRecommededEnvironment(resource);
        // Already selected workspace env, hence nothing to do.
        if (recommededEnv?.reason === 'workspaceUserSelected' && workspace.workspaceFolders?.length) {
            return recommededEnv.environment;
        }
        // No workspace folders, and the user selected a global environment.
        if (recommededEnv?.reason === 'globalUserSelected' && !workspace.workspaceFolders?.length) {
            return recommededEnv.environment;
        }
    }
}
