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
    Uri,
    workspace,
    MarkdownString,
    ConfigurationTarget,
    commands,
} from 'vscode';
import { Environment, PythonExtension } from '../api/types';
import { IServiceContainer } from '../ioc/types';
import { ICodeExecutionService } from '../terminals/types';
import { TerminalCodeExecutionProvider } from '../terminals/codeExecution/terminalCodeExecution';
import { getEnvironmentDetails, raceCancellationError } from './utils';
import { resolveFilePath } from './utils';
import { IPythonPathUpdaterServiceManager } from '../interpreter/configuration/types';
import { ITerminalHelper } from '../common/terminal/types';
import { raceTimeout } from '../common/utils/async';
import { IDiscoveryAPI } from '../pythonEnvironments/base/locator';
import { Commands } from '../common/constants';
import { CreateEnvironmentResult } from '../pythonEnvironments/creation/proposed.createEnvApis';
import { IInterpreterPathService } from '../common/types';
import { DisposableStore } from '../common/utils/resourceLifecycle';
import { isParentPath } from '../common/platform/fs-paths';

export interface IResourceReference {
    resourcePath?: string;
    option?: 'string';
}

let _environmentConfigured = false;

export class ConfigurePythonEnvTool implements LanguageModelTool<IResourceReference> {
    private readonly terminalExecutionService: TerminalCodeExecutionProvider;
    private readonly terminalHelper: ITerminalHelper;
    private readonly pythonPathUpdater: IPythonPathUpdaterServiceManager;
    public static readonly toolName = 'configure_python_environment';
    constructor(
        private readonly api: PythonExtension['environments'],
        private readonly discovery: IDiscoveryAPI,
        private readonly serviceContainer: IServiceContainer,
    ) {
        this.terminalExecutionService = this.serviceContainer.get<TerminalCodeExecutionProvider>(
            ICodeExecutionService,
            'standard',
        );
        this.terminalHelper = this.serviceContainer.get<ITerminalHelper>(ITerminalHelper);
        this.pythonPathUpdater = this.serviceContainer.get<IPythonPathUpdaterServiceManager>(
            IPythonPathUpdaterServiceManager,
        );
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
        const resource = resolveFilePath(options.input.resourcePath);
        const workspaceEnv = await getWorkspaceSpecificEnv(this.api, resource);
        let createEnv = false;
        let selectEnv = false;
        if (options.input.option?.toLowerCase() === 'createenv') {
            createEnv = true;
        }
        if (options.input.option?.toLowerCase() === 'selectenv') {
            selectEnv = true;
        }
        if (this.useWorkflow && !createEnv && !selectEnv) {
            // If the user has enabled the workflow, we don't create or select an environment.
            return new LanguageModelToolResult([
                new LanguageModelTextPart(
                    [
                        'There are two ways to configure a Python Environment',
                        '- Option 1: Create a new Python Environment',
                        `If a user selects this option, then invoke this ${ConfigurePythonEnvTool.toolName} tool again with the same file path and the option 'createenv'`,
                        `If the user cancels the creation of the environment, then invoke this ${ConfigurePythonEnvTool.toolName} tool again with the same file path and the option 'selectenv'`,
                        '- Option 2: Select an existing Python Environment',
                        `If a user selects this option, then invoke this ${ConfigurePythonEnvTool.toolName} tool again with the same file path and the option 'selectenv'`,
                        `If the user cancels this, then there is nothing more we can do, let the user know that a Python environment needs to be configured`,
                        `Ask the user which of the two options they want to choose, and invoke this ${ConfigurePythonEnvTool.toolName} tool again with the same file path and the option 'createenv' or 'selectenv'`,
                    ].join('\n'),
                ),
            ]);
        }
        if (
            !createEnv &&
            (workspaceEnv?.outcome === 'alreadySelectedAndRecommended' ||
                workspaceEnv?.outcome === 'alreadySelectedButNotRecommended' ||
                ConfigurePythonEnvTool.EnvironmentConfigured)
        ) {
            return await getEnvDetailsForResponse(
                this.api,
                this.terminalExecutionService,
                this.terminalHelper,
                resource,
                token,
            );
        }

        const disposable = new DisposableStore();
        disposable.add(hidePostEnvCreationMessage());
        try {
            if (!selectEnv && (createEnv || !workspaceEnv) && workspace.workspaceFolders?.length) {
                const envConfigured = await createAndSelectPythonEnvironment(this.serviceContainer, disposable);
                if (!envConfigured) {
                    if (createEnv) {
                        return new LanguageModelToolResult([
                            new LanguageModelTextPart(
                                [
                                    'Creation of Python Environment failed or was cancelled by the user, try another option if possible.',
                                    'Before trying another option, let the user know about this and the fact that another option will be tried',
                                    'DO NOT retry the same option again, as that will lead to an infinite loop',
                                ].join('\n'),
                            ),
                        ]);
                    }

                    return new LanguageModelToolResult([
                        new LanguageModelTextPart(
                            [
                                'No Python Environment configured and creation of Python Environment failed or was cancelled by the user, try another option if possible.',
                                'Before trying another option, let the user know about this and the fact that another option will be tried',
                                'DO NOT retry the same option again, as that will lead to an infinite loop',
                            ].join('\n'),
                        ),
                    ]);
                }
            }
            if (selectEnv) {
                const selected = await Promise.resolve(commands.executeCommand(Commands.Set_Interpreter));
                if (!selected) {
                    return new LanguageModelToolResult([
                        new LanguageModelTextPart('User did not select a Python Environment.'),
                    ]);
                }
            }
            if (!createEnv && !selectEnv && workspaceEnv?.outcome === 'recommended') {
                _environmentConfigured = true;
                await this.pythonPathUpdater.updatePythonPath(
                    workspaceEnv.env.path,
                    ConfigurationTarget.WorkspaceFolder,
                    'ui',
                    resource,
                );
            }

            return await getEnvDetailsForResponse(
                this.api,
                this.terminalExecutionService,
                this.terminalHelper,
                resource,
                token,
            );
        } catch (error) {
            if (error instanceof CancellationError) {
                return new LanguageModelToolResult([new LanguageModelTextPart('User cancelled the operation.')]);
            }
            const errorMessage: string = `An error occurred while fetching environment information: ${error}`;
            return new LanguageModelToolResult([new LanguageModelTextPart(errorMessage)]);
        } finally {
            disposable.dispose();
        }
    }

    async prepareInvocation?(
        options: LanguageModelToolInvocationPrepareOptions<IResourceReference>,
        _token: CancellationToken,
    ): Promise<PreparedToolInvocation> {
        if (_environmentConfigured) {
            return {};
        }
        if (this.useWorkflow) {
            if (options.input.option?.toLowerCase() === 'createenv') {
                return {
                    invocationMessage: l10n.t('Creating a Python environment'),
                };
            }
            if (options.input.option?.toLowerCase() === 'selectenv') {
                return {
                    invocationMessage: l10n.t('Selecting a Python environment'),
                };
            }
            return {};
        }
        const resource = resolveFilePath(options.input.resourcePath);
        const workspaceEnv = await getWorkspaceSpecificEnv(this.api, resource);
        if (options.input.option?.toLowerCase() === 'selectenv') {
            return {
                confirmationMessages: {
                    title: l10n.t('Select a Python Environment?'),
                    message:
                        'You will be prompted to select a Python environment from the list of available environments.',
                },
                invocationMessage: l10n.t('Configuring a Python environment'),
            };
        }
        if (!workspaceEnv || options.input.option?.toLowerCase() === 'createenv') {
            if (workspace.workspaceFolders?.length) {
                return {
                    confirmationMessages: {
                        title: l10n.t('Create a Virtual Environment?'),
                        message: new MarkdownString(
                            l10n.t(
                                'Creating a Virtual Environment is recommended. This provides the benefit of preventing conflicts between packages in this environment and others.',
                            ),
                        ),
                    },
                    invocationMessage: l10n.t('Creating a Python environment'),
                };
            }
            return {
                confirmationMessages: {
                    title: l10n.t('Configure a Python Environment?'),
                    message: '',
                },
                invocationMessage: l10n.t('Configuring a Python environment'),
            };
        }
        switch (workspaceEnv.outcome) {
            case 'recommended': {
                const name = await this.discovery
                    .resolveEnv(workspaceEnv.env.path)
                    .then((e) => e?.display || e?.name)
                    .catch(() => undefined)
                    .then((name) => name || workspaceEnv.env.environment?.name || workspaceEnv.env.path);
                return {
                    confirmationMessages: {
                        title: l10n.t('Use recommended Python Environment?'),
                        message: new MarkdownString(
                            l10n.t('The Python environment `{0}` is recommeded for use in this workspace.', name),
                        ),
                    },
                };
            }
            default: {
                return {};
            }
        }
    }
}

async function getWorkspaceSpecificEnv(
    api: PythonExtension['environments'],
    uri: Uri | undefined,
): Promise<
    | {
          env: Environment;
          outcome: 'alreadySelectedButNotRecommended' | 'alreadySelectedAndRecommended' | 'recommended';
      }
    | undefined
> {
    const activeGlobal = await api.resolveEnvironment(api.getActiveEnvironmentPath(undefined));
    const workspaceFolder = uri ? workspace.getWorkspaceFolder(uri)?.uri : undefined;
    if (!uri || !workspaceFolder) {
        return activeGlobal ? { env: activeGlobal, outcome: 'alreadySelectedButNotRecommended' } : undefined;
    }

    const preferredLocalEnv = api.known.find(
        (env) =>
            (env.environment?.workspaceFolder &&
                env.environment.workspaceFolder.uri.path.toLowerCase() === workspaceFolder.path.toLowerCase()) ||
            (env.environment?.folderUri && isParentPath(env.environment.folderUri.fsPath, workspaceFolder.fsPath)),
    );

    if (!preferredLocalEnv) {
        return;
    }

    const activeWorkspaceEnv = api.getActiveEnvironmentPath(uri);

    if (activeWorkspaceEnv.id === preferredLocalEnv.id) {
        return { env: preferredLocalEnv, outcome: 'alreadySelectedAndRecommended' };
    }
    if (activeWorkspaceEnv.id !== preferredLocalEnv.id && activeGlobal?.id === activeWorkspaceEnv.id) {
        // If the active global environment is the same as the workspace environment, we recommend using the workspace environment.
        // This most likely means the user has not set a workspace-specific environment.
        return { env: preferredLocalEnv, outcome: 'recommended' };
    }
}

/**
 * Creates and selects a Python environment using the service container and waits for the environment to be set as active.
 * Returns true if an environment was created and selected, false otherwise.
 */
async function createAndSelectPythonEnvironment(
    serviceContainer: IServiceContainer,
    disposable: DisposableStore,
): Promise<boolean> {
    const interpreterPathService = serviceContainer.get<IInterpreterPathService>(IInterpreterPathService);
    const interpreterChanged = new Promise<void>((resolve) => {
        disposable.add(interpreterPathService.onDidChange(() => resolve()));
    });
    const createdEnv = (await Promise.resolve(
        commands.executeCommand(Commands.Create_Environment, {
            showBackButton: false,
            selectEnvironment: true,
        }),
    )) as CreateEnvironmentResult | undefined;
    if (!createdEnv) {
        return false;
    }
    _environmentConfigured = true;
    // Wait a few secs to ensure the env is selected as the active environment..
    await raceTimeout(5_000, interpreterChanged);
    return true;
}

async function getEnvDetailsForResponse(
    api: PythonExtension['environments'],
    terminalExecutionService: TerminalCodeExecutionProvider,
    terminalHelper: ITerminalHelper,
    resource: Uri | undefined,
    token: CancellationToken,
): Promise<LanguageModelToolResult> {
    // environment
    const envPath = api.getActiveEnvironmentPath(resource);
    const environment = await raceCancellationError(api.resolveEnvironment(envPath), token);
    if (!environment || !environment.version) {
        throw new Error('No environment found for the provided resource path: ' + resource?.fsPath);
    }
    trackEnvUsedByTool(resource, environment);
    const message = await getEnvironmentDetails(
        resource,
        api,
        terminalExecutionService,
        terminalHelper,
        undefined,
        token,
    );
    return new LanguageModelToolResult([new LanguageModelTextPart(message)]);
}
