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
    l10n,
} from 'vscode';
import { PythonExtension } from '../api/types';
import { IServiceContainer } from '../ioc/types';
import { ICodeExecutionService } from '../terminals/types';
import { TerminalCodeExecutionProvider } from '../terminals/codeExecution/terminalCodeExecution';
import {
    getEnvDetailsForResponse,
    getEnvTypeForTelemetry,
    getToolResponseIfNotebook,
    getPythonToolResponse,
    getPythonToolTelemetry,
    getPythonToolResourcePath,
    IResourceReference,
    invokePythonTool,
    invokePythonToolCompatibility,
    isCancellationError,
    raceCancellationError,
    setEnvironmentDirectlyByPath,
    PYTHON_TOOLS_UNAVAILABLE,
} from './utils';
import { ITerminalHelper } from '../common/terminal/types';
import { IRecommendedEnvironmentService } from '../interpreter/configuration/types';
import { CreateVirtualEnvTool } from './createVirtualEnvTool';
import { ISelectPythonEnvToolArguments, SelectPythonEnvTool } from './selectEnvTool';
import { BaseTool } from './baseTool';
import { traceVerbose } from '../logging';
import { ErrorWithTelemetrySafeReason } from '../common/errors/errorUtils';
import { useEnvExtension } from '../envExt/api.internal';

export interface IConfigurePythonEnvToolArguments extends IResourceReference {
    /** Selects this exact existing interpreter, even if global; omission requests an isolated environment. */
    pythonPath?: string;
}

export class ConfigurePythonEnvTool extends BaseTool<IConfigurePythonEnvToolArguments>
    implements LanguageModelTool<IConfigurePythonEnvToolArguments> {
    private readonly terminalExecutionService: TerminalCodeExecutionProvider;
    private readonly terminalHelper: ITerminalHelper;
    private readonly recommendedEnvService: IRecommendedEnvironmentService;
    public static readonly toolName = 'configure_python_environment';
    constructor(
        private readonly api: PythonExtension['environments'],
        private readonly serviceContainer: IServiceContainer,
        private readonly createEnvTool: CreateVirtualEnvTool,
    ) {
        super(ConfigurePythonEnvTool.toolName);
        this.terminalExecutionService = this.serviceContainer.get<TerminalCodeExecutionProvider>(
            ICodeExecutionService,
            'standard',
        );
        this.terminalHelper = this.serviceContainer.get<ITerminalHelper>(ITerminalHelper);
        this.recommendedEnvService = this.serviceContainer.get<IRecommendedEnvironmentService>(
            IRecommendedEnvironmentService,
        );
    }

    async invokeImpl(
        options: LanguageModelToolInvocationOptions<IConfigurePythonEnvToolArguments>,
        resource: Uri | undefined,
        token: CancellationToken,
    ): Promise<LanguageModelToolResult> {
        const notebookResponse = getToolResponseIfNotebook(resource);
        if (notebookResponse) {
            this.extraTelemetryProperties.resolveOutcome = 'notebook';
            return notebookResponse;
        }

        if (useEnvExtension()) {
            const resourcePath = getPythonToolResourcePath(options.input.resourcePath, resource);
            const result = await invokePythonTool(
                (api) => api.configureEnvironment({ resourcePath, pythonPath: options.input.pythonPath }, token),
                token,
            );
            if (result !== PYTHON_TOOLS_UNAVAILABLE) {
                this.extraTelemetryProperties.envType = getPythonToolTelemetry(result?.environment).envType;
                this.extraTelemetryProperties.resolveOutcome =
                    result?.status === 'success'
                        ? result.created === true
                            ? 'createdVirtualEnv'
                            : options.input.pythonPath
                            ? 'providedEnv'
                            : 'existingWorkspaceEnv'
                        : result?.status ?? 'invalidResult';
                return getPythonToolResponse(result, l10n.t('A Python Environment has been configured.'));
            }
            return invokePythonToolCompatibility(resourcePath, resource, token, (target) =>
                this.invokePreviousFlow(
                    {
                        ...options,
                        input: {
                            ...options.input,
                            resourcePath: target.scheme === 'file' ? target.fsPath : target.toString(),
                        },
                    },
                    target,
                    token,
                ),
            );
        }

        return this.invokePreviousFlow(options, resource, token);
    }

    private async invokePreviousFlow(
        options: LanguageModelToolInvocationOptions<IConfigurePythonEnvToolArguments>,
        resource: Uri | undefined,
        token: CancellationToken,
    ): Promise<LanguageModelToolResult> {
        // Fast path: if the caller provided a pythonPath, set it directly without any UI.
        if (options.input.pythonPath) {
            return this.setEnvironmentDirectly(options.input.pythonPath, resource, token);
        }

        const workspaceSpecificEnv = await raceCancellationError(
            this.hasAlreadyGotAWorkspaceSpecificEnvironment(resource),
            token,
        );

        if (workspaceSpecificEnv) {
            this.extraTelemetryProperties.resolveOutcome = 'existingWorkspaceEnv';
            this.extraTelemetryProperties.envType = getEnvTypeForTelemetry(workspaceSpecificEnv);
            return getEnvDetailsForResponse(
                workspaceSpecificEnv,
                this.api,
                this.terminalExecutionService,
                this.terminalHelper,
                resource,
                token,
            );
        }

        if (await this.createEnvTool.shouldCreateNewVirtualEnv(resource, token)) {
            try {
                const result = await lm.invokeTool(CreateVirtualEnvTool.toolName, options, token);
                this.extraTelemetryProperties.resolveOutcome = 'createdVirtualEnv';
                return result;
            } catch (ex) {
                if (isCancellationError(ex)) {
                    const input: ISelectPythonEnvToolArguments = {
                        ...options.input,
                        reason: 'cancelled',
                    };
                    // If the user cancelled the tool, then we should invoke the select env tool.
                    this.extraTelemetryProperties.resolveOutcome = 'selectedEnvAfterCancelledCreate';
                    return lm.invokeTool(SelectPythonEnvTool.toolName, { ...options, input }, token);
                }
                throw ex;
            }
        } else {
            const input: ISelectPythonEnvToolArguments = {
                ...options.input,
            };
            this.extraTelemetryProperties.resolveOutcome = 'selectedEnv';
            return lm.invokeTool(SelectPythonEnvTool.toolName, { ...options, input }, token);
        }
    }

    /**
     * Sets the given interpreter path directly without user interaction, then
     * resolves and returns the environment details.
     */
    private async setEnvironmentDirectly(
        pythonPath: string,
        resource: Uri | undefined,
        token: CancellationToken,
    ): Promise<LanguageModelToolResult> {
        traceVerbose(`${ConfigurePythonEnvTool.toolName}: setting environment directly from pythonPath: ${pythonPath}`);
        const result = await setEnvironmentDirectlyByPath(pythonPath, this.api, resource, token);
        if (result) {
            this.extraTelemetryProperties.resolveOutcome = 'providedEnv';
            this.extraTelemetryProperties.envType = getEnvTypeForTelemetry(result);
            return getEnvDetailsForResponse(
                result,
                this.api,
                this.terminalExecutionService,
                this.terminalHelper,
                resource,
                token,
            );
        }
        throw new ErrorWithTelemetrySafeReason(
            `No environment found for the provided pythonPath '${pythonPath}'.`,
            'noEnvFound',
        );
    }

    async prepareInvocationImpl(
        options: LanguageModelToolInvocationPrepareOptions<IConfigurePythonEnvToolArguments>,
        resource: Uri | undefined,
        _token: CancellationToken,
    ): Promise<PreparedToolInvocation> {
        if (useEnvExtension()) {
            if (getToolResponseIfNotebook(resource)) {
                return {};
            }
            const target = getPythonToolResourcePath(options.input.resourcePath, resource);
            return {
                confirmationMessages: {
                    title: l10n.t('Configure a Python Environment?'),
                    message: options.input.pythonPath
                        ? l10n.t(
                              'Select the exact existing Python interpreter or environment at {0} for {1}, even if it is global or Conda base. With a compatible Python Environments tools API, selection runs without extension pickers; package installation still rejects global Python and Conda base.',
                              options.input.pythonPath,
                              target ?? l10n.t('the requested resource'),
                          )
                        : l10n.t(
                              'Configure {0}. With a compatible Python Environments tools API, reuse an isolated environment or create and select one without extension pickers. A selected global Python is used to create a venv, whether selected automatically or manually; Conda base is used to create an isolated Conda environment.',
                              target ?? l10n.t('the requested Python project'),
                          ),
                },
                invocationMessage: target
                    ? l10n.t('Configuring a Python Environment for {0}', target)
                    : l10n.t('Configuring a Python Environment'),
            };
        }
        return {
            invocationMessage: l10n.t('Configuring a Python Environment'),
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
