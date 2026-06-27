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
    QuickPickItemKind,
} from 'vscode';
import { PythonExtension } from '../api/types';
import { IServiceContainer } from '../ioc/types';
import { ICodeExecutionService } from '../terminals/types';
import { TerminalCodeExecutionProvider } from '../terminals/codeExecution/terminalCodeExecution';
import {
    doesWorkspaceHaveVenvOrCondaEnv,
    getEnvDetailsForResponse,
    getToolResponseIfNotebook,
    IResourceReference,
    raceCancellationError,
    setEnvironmentDirectlyByPath,
} from './utils';
import { ITerminalHelper } from '../common/terminal/types';
import { raceTimeout } from '../common/utils/async';
import { Commands, Octicons } from '../common/constants';
import { CreateEnvironmentResult } from '../pythonEnvironments/creation/proposed.createEnvApis';
import { IInterpreterPathService } from '../common/types';
import { SelectEnvironmentResult } from '../interpreter/configuration/interpreterSelector/commands/setInterpreter';
import { Common, InterpreterQuickPickList } from '../common/utils/localize';
import { showQuickPick } from '../common/vscodeApis/windowApis';
import { DisposableStore } from '../common/utils/resourceLifecycle';
import { traceError, traceVerbose, traceWarn } from '../logging';
import { BaseTool } from './baseTool';

export interface ISelectPythonEnvToolArguments extends IResourceReference {
    reason?: 'cancelled';
    /**
     * Optional path to a Python interpreter. When provided, the tool sets this
     * interpreter directly without showing any Quick Pick UI to the user.
     * This prevents the agent from getting stuck waiting for user input in
     * autopilot / bypass-approvals mode.
     */
    pythonPath?: string;
}

export class SelectPythonEnvTool extends BaseTool<ISelectPythonEnvToolArguments>
    implements LanguageModelTool<ISelectPythonEnvToolArguments> {
    private readonly terminalExecutionService: TerminalCodeExecutionProvider;
    private readonly terminalHelper: ITerminalHelper;
    public static readonly toolName = 'selectEnvironment';
    constructor(
        private readonly api: PythonExtension['environments'],
        private readonly serviceContainer: IServiceContainer,
    ) {
        super(SelectPythonEnvTool.toolName);
        this.terminalExecutionService = this.serviceContainer.get<TerminalCodeExecutionProvider>(
            ICodeExecutionService,
            'standard',
        );
        this.terminalHelper = this.serviceContainer.get<ITerminalHelper>(ITerminalHelper);
    }

    async invokeImpl(
        options: LanguageModelToolInvocationOptions<ISelectPythonEnvToolArguments>,
        resource: Uri | undefined,
        token: CancellationToken,
    ): Promise<LanguageModelToolResult> {
        const notebookResponse = getToolResponseIfNotebook(resource);
        if (notebookResponse) {
            return notebookResponse;
        }

        // Fast path: if the caller provided a pythonPath, set it directly without any UI.
        if (options.input.pythonPath) {
            traceVerbose(
                `${SelectPythonEnvTool.toolName}: setting environment directly from pythonPath: ${options.input.pythonPath}`,
            );
            const result = await setEnvironmentDirectlyByPath(
                options.input.pythonPath,
                this.api,
                this.terminalExecutionService,
                this.terminalHelper,
                resource,
                token,
            );
            if (result) {
                return result;
            }
            return new LanguageModelToolResult([
                new LanguageModelTextPart(
                    `The provided pythonPath '${options.input.pythonPath}' could not be resolved to a valid Python environment.`,
                ),
            ]);
        }

        let selected: boolean | undefined = false;
        const hasVenvOrCondaEnvInWorkspaceFolder = doesWorkspaceHaveVenvOrCondaEnv(resource, this.api);
        if (options.input.reason === 'cancelled' || hasVenvOrCondaEnvInWorkspaceFolder) {
            const result = await raceCancellationError(
                Promise.resolve(
                    commands.executeCommand(Commands.Set_Interpreter, {
                        hideCreateVenv: false,
                        showBackButton: false,
                    }),
                ) as Promise<SelectEnvironmentResult | undefined>,
                token,
            );
            if (result?.path) {
                traceVerbose(`User selected a Python environment ${result.path} in Select Python Tool.`);
                selected = true;
            } else {
                traceWarn(`User did not select a Python environment in Select Python Tool.`);
            }
        } else {
            selected = await raceCancellationError(
                showCreateAndSelectEnvironmentQuickPick(resource, this.serviceContainer),
                token,
            );
            if (selected) {
                traceVerbose(`User selected a Python environment ${selected} in Select Python Tool(2).`);
            } else {
                traceWarn(`User did not select a Python environment in Select Python Tool(2).`);
            }
        }
        const env = selected
            ? await this.api.resolveEnvironment(this.api.getActiveEnvironmentPath(resource))
            : undefined;
        if (selected && !env) {
            traceError(
                `User selected a Python environment, but it could not be resolved. This is unexpected. Environment: ${this.api.getActiveEnvironmentPath(
                    resource,
                )}`,
            );
        }
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

    async prepareInvocationImpl(
        options: LanguageModelToolInvocationPrepareOptions<ISelectPythonEnvToolArguments>,
        resource: Uri | undefined,
        _token: CancellationToken,
    ): Promise<PreparedToolInvocation> {
        if (getToolResponseIfNotebook(resource)) {
            return {};
        }
        // Fast path: skip the confirmation prompt when the model has already supplied
        // a specific interpreter to use. Showing a confirmation here would defeat the
        // purpose of the autopilot/bypass-approvals fast path.
        if (options.input.pythonPath) {
            return {};
        }
        const hasVenvOrCondaEnvInWorkspaceFolder = doesWorkspaceHaveVenvOrCondaEnv(resource, this.api);

        if (
            hasVenvOrCondaEnvInWorkspaceFolder ||
            !workspace.workspaceFolders?.length ||
            options.input.reason === 'cancelled'
        ) {
            return {
                confirmationMessages: {
                    title: l10n.t('Select a Python Environment?'),
                    message: '',
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
