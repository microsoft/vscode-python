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
    Uri,
    workspace,
    commands,
    QuickPickItem,
} from 'vscode';
import { PythonExtension, ResolvedEnvironment } from '../api/types';
import { IServiceContainer } from '../ioc/types';
import { ICodeExecutionService } from '../terminals/types';
import { TerminalCodeExecutionProvider } from '../terminals/codeExecution/terminalCodeExecution';
import { getEnvironmentDetails, getToolResponseIfNotebook, raceCancellationError } from './utils';
import { resolveFilePath } from './utils';
import { IRecommendedEnvironmentService } from '../interpreter/configuration/types';
import { ITerminalHelper } from '../common/terminal/types';
import { raceTimeout } from '../common/utils/async';
import { Commands, Octicons } from '../common/constants';
import { CreateEnvironmentResult } from '../pythonEnvironments/creation/proposed.createEnvApis';
import { IInterpreterPathService } from '../common/types';
import { DisposableStore } from '../common/utils/resourceLifecycle';
import { Common, InterpreterQuickPickList } from '../common/utils/localize';
import { QuickPickItemKind } from '../../test/mocks/vsc';
import { showQuickPick } from '../common/vscodeApis/windowApis';
import { SelectEnvironmentResult } from '../interpreter/configuration/interpreterSelector/commands/setInterpreter';

export interface IResourceReference {
    resourcePath?: string;
}

let _environmentConfigured = false;

export class ConfigurePythonEnvTool implements LanguageModelTool<IResourceReference> {
    private readonly terminalExecutionService: TerminalCodeExecutionProvider;
    private readonly terminalHelper: ITerminalHelper;
    private readonly recommendedEnvService: IRecommendedEnvironmentService;
    public static readonly toolName = 'configure_python_environment';
    constructor(
        private readonly api: PythonExtension['environments'],
        private readonly serviceContainer: IServiceContainer,
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
        const notebookResponse = getToolResponseIfNotebook(resource);
        if (notebookResponse) {
            return notebookResponse;
        }

        const recommededEnv = await this.recommendedEnvService.getRecommededEnvironment(resource);
        // Already selected workspace env, hence nothing to do.
        if (recommededEnv?.reason === 'workspaceUserSelected' && workspace.workspaceFolders?.length) {
            return await getEnvDetailsForResponse(
                recommededEnv.environment,
                this.api,
                this.terminalExecutionService,
                this.terminalHelper,
                resource,
                token,
            );
        }
        // No workspace folders, and the user selected a global environment.
        if (recommededEnv?.reason === 'globalUserSelected' && !workspace.workspaceFolders?.length) {
            return await getEnvDetailsForResponse(
                recommededEnv.environment,
                this.api,
                this.terminalExecutionService,
                this.terminalHelper,
                resource,
                token,
            );
        }

        if (!workspace.workspaceFolders?.length) {
            const selected = await Promise.resolve(commands.executeCommand(Commands.Set_Interpreter));
            const env = await this.api.resolveEnvironment(this.api.getActiveEnvironmentPath(resource));
            if (selected && env) {
                return await getEnvDetailsForResponse(
                    env,
                    this.api,
                    this.terminalExecutionService,
                    this.terminalHelper,
                    resource,
                    token,
                );
            }
            return new LanguageModelToolResult([
                new LanguageModelTextPart('User did not select a Python environment.'),
            ]);
        }

        const selected = await showCreateAndSelectEnvironmentQuickPick(resource, this.serviceContainer);
        const env = await this.api.resolveEnvironment(this.api.getActiveEnvironmentPath(resource));
        if (selected && env) {
            return await getEnvDetailsForResponse(
                env,
                this.api,
                this.terminalExecutionService,
                this.terminalHelper,
                resource,
                token,
            );
        }
        return new LanguageModelToolResult([
            new LanguageModelTextPart('User did not create nor select a Python environment.'),
        ]);
    }

    async prepareInvocation?(
        options: LanguageModelToolInvocationPrepareOptions<IResourceReference>,
        _token: CancellationToken,
    ): Promise<PreparedToolInvocation> {
        if (_environmentConfigured) {
            return {};
        }
        const resource = resolveFilePath(options.input.resourcePath);
        if (getToolResponseIfNotebook(resource)) {
            return {};
        }
        const recommededEnv = await this.recommendedEnvService.getRecommededEnvironment(resource);
        // Already selected workspace env, hence nothing to do.
        if (recommededEnv?.reason === 'workspaceUserSelected' && workspace.workspaceFolders?.length) {
            return {};
        }
        // No workspace folders, and the user selected a global environment.
        if (recommededEnv?.reason === 'globalUserSelected' && !workspace.workspaceFolders?.length) {
            return {};
        }

        if (!workspace.workspaceFolders?.length) {
            return {
                confirmationMessages: {
                    title: l10n.t('Configure a Python Environment?'),
                    message: l10n.t('You will be prompted to select a Python Environment.'),
                },
            };
        }
        return {
            confirmationMessages: {
                title: l10n.t('Configure a Python Environment?'),
                message: l10n.t(
                    [
                        'The recommended option is to create a new Python Environment, providing the benefit of isolating packages from other environments.  ',
                        'Optionally you could select an existing Python Environment.',
                    ].join('\n'),
                ),
            },
        };
    }
}

async function getEnvDetailsForResponse(
    environment: ResolvedEnvironment | undefined,
    api: PythonExtension['environments'],
    terminalExecutionService: TerminalCodeExecutionProvider,
    terminalHelper: ITerminalHelper,
    resource: Uri | undefined,
    token: CancellationToken,
): Promise<LanguageModelToolResult> {
    const envPath = api.getActiveEnvironmentPath(resource);
    environment = environment || (await raceCancellationError(api.resolveEnvironment(envPath), token));
    if (!environment || !environment.version) {
        throw new Error('No environment found for the provided resource path: ' + resource?.fsPath);
    }
    const message = await getEnvironmentDetails(
        resource,
        api,
        terminalExecutionService,
        terminalHelper,
        undefined,
        token,
    );
    return new LanguageModelToolResult([
        new LanguageModelTextPart(`A Python Environment has been configured.  \n` + message),
    ]);
}

async function showCreateAndSelectEnvironmentQuickPick(
    uri: Uri | undefined,
    serviceContainer: IServiceContainer,
): Promise<boolean | undefined> {
    const createLabel = `${Octicons.Add} ${InterpreterQuickPickList.create.label}`;
    const selectLabel = l10n.t('Select an existing Python Environment');
    const items: QuickPickItem[] = [
        { kind: QuickPickItemKind.Separator, label: Common.recommended },
        { label: createLabel },
        { label: selectLabel },
    ];

    const selectedItem = await showQuickPick(items, {
        placeHolder: l10n.t('Configure a Python Environment'),
        matchOnDescription: true,
        ignoreFocusOut: true,
    });

    if (selectedItem && !Array.isArray(selectedItem) && selectedItem.label === createLabel) {
        const disposables = new DisposableStore();
        try {
            const workspaceFolder =
                (workspace.workspaceFolders?.length && uri ? workspace.getWorkspaceFolder(uri) : undefined) ||
                (workspace.workspaceFolders?.length === 1 ? workspace.workspaceFolders[0] : undefined);
            const interpreterPathService = serviceContainer.get<IInterpreterPathService>(IInterpreterPathService);
            const interpreterChanged = new Promise<void>((resolve) => {
                disposables.add(interpreterPathService.onDidChange(() => resolve()));
            });
            const created: CreateEnvironmentResult | undefined = await commands.executeCommand(
                Commands.Create_Environment,
                {
                    showBackButton: true,
                    selectEnvironment: true,
                    workspaceFolder,
                },
            );

            if (created?.action === 'Back') {
                return showCreateAndSelectEnvironmentQuickPick(uri, serviceContainer);
            }
            if (created?.action === 'Cancel') {
                return undefined;
            }
            if (created?.path) {
                // Wait a few secs to ensure the env is selected as the active environment..
                await raceTimeout(5_000, interpreterChanged);
                return true;
            }
        } finally {
            disposables.dispose();
        }
    }
    if (selectedItem && !Array.isArray(selectedItem) && selectedItem.label === selectLabel) {
        const result = (await Promise.resolve(
            commands.executeCommand(Commands.Set_Interpreter, { hideCreateVenv: true, showBackButton: true }),
        )) as SelectEnvironmentResult | undefined;
        if (result?.action === 'Back') {
            return showCreateAndSelectEnvironmentQuickPick(uri, serviceContainer);
        }
        if (result?.action === 'Cancel') {
            return undefined;
        }
        if (result?.path) {
            return true;
        }
    }
}
