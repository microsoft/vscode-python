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
} from 'vscode';
import { PythonExtension, ResolvedEnvironment } from '../api/types';
import { IServiceContainer } from '../ioc/types';
import { ICodeExecutionService } from '../terminals/types';
import { TerminalCodeExecutionProvider } from '../terminals/codeExecution/terminalCodeExecution';
import { getEnvDisplayName, isCondaEnv, raceCancellationError } from './utils';
import { resolveFilePath } from './utils';
import { traceError } from '../logging';
import { ITerminalHelper, TerminalShellType } from '../common/terminal/types';
import { IDiscoveryAPI } from '../pythonEnvironments/base/locator';
import { Conda } from '../pythonEnvironments/common/environmentManagers/conda';

export interface IResourceReference {
    resourcePath?: string;
}

export class GetExecutableTool implements LanguageModelTool<IResourceReference> {
    private readonly terminalExecutionService: TerminalCodeExecutionProvider;
    private readonly terminalHelper: ITerminalHelper;
    public static readonly toolName = 'get_python_executable';
    constructor(
        private readonly api: PythonExtension['environments'],
        private readonly serviceContainer: IServiceContainer,
        private readonly discovery: IDiscoveryAPI,
    ) {
        this.terminalExecutionService = this.serviceContainer.get<TerminalCodeExecutionProvider>(
            ICodeExecutionService,
            'standard',
        );
        this.terminalHelper = this.serviceContainer.get<ITerminalHelper>(ITerminalHelper);
    }
    async invoke(
        options: LanguageModelToolInvocationOptions<IResourceReference>,
        token: CancellationToken,
    ): Promise<LanguageModelToolResult> {
        const resourcePath = resolveFilePath(options.input.resourcePath);

        try {
            // environment
            const envPath = this.api.getActiveEnvironmentPath(resourcePath);
            const environment = await raceCancellationError(this.api.resolveEnvironment(envPath), token);
            if (!environment || !environment.version) {
                throw new Error('No environment found for the provided resource path: ' + resourcePath?.fsPath);
            }
            const runCommand = await raceCancellationError(
                getTerminalCommand(environment, resourcePath, this.terminalExecutionService, this.terminalHelper),
                token,
            );

            const message = [
                `Following is the information about the Python environment:`,
                `1. Environment Type: ${environment.environment?.type || 'unknown'}`,
                `2. Version: ${environment.version.sysVersion || 'unknown'}`,
                '',
                `3. Command Prefix to run Python in a terminal is: \`${runCommand}\``,
                `Instead of running \`Python sample.py\` in the terminal, you will now run: \`${runCommand} sample.py\``,
                `Similarly instead of running \`Python -c "import sys;...."\` in the terminal, you will now run: \`${runCommand} -c "import sys;...."\``,
            ];
            return new LanguageModelToolResult([new LanguageModelTextPart(message.join('\n'))]);
        } catch (error) {
            if (error instanceof CancellationError) {
                throw error;
            }
            traceError('Error while getting environment information', error);
            const errorMessage: string = `An error occurred while fetching environment information: ${error}`;
            return new LanguageModelToolResult([new LanguageModelTextPart(errorMessage)]);
        }
    }

    async prepareInvocation?(
        options: LanguageModelToolInvocationPrepareOptions<IResourceReference>,
        token: CancellationToken,
    ): Promise<PreparedToolInvocation> {
        const resourcePath = resolveFilePath(options.input.resourcePath);
        const envName = await raceCancellationError(getEnvDisplayName(this.discovery, resourcePath, this.api), token);
        return {
            invocationMessage: envName
                ? l10n.t('Fetching Python executable information for {0}', envName)
                : l10n.t('Fetching Python executable information'),
        };
    }
}

export async function getTerminalCommand(
    environment: ResolvedEnvironment,
    resource: Uri | undefined,
    terminalExecutionService: TerminalCodeExecutionProvider,
    terminalHelper: ITerminalHelper,
): Promise<string> {
    let cmd: { command: string; args: string[] };
    if (isCondaEnv(environment)) {
        cmd = (await getCondaRunCommand(environment)) || (await terminalExecutionService.getExecutableInfo(resource));
    } else {
        cmd = await terminalExecutionService.getExecutableInfo(resource);
    }
    return terminalHelper.buildCommandForTerminal(TerminalShellType.other, cmd.command, cmd.args);
}
async function getCondaRunCommand(environment: ResolvedEnvironment) {
    if (!environment.executable.uri) {
        return;
    }
    const conda = await Conda.getConda();
    if (!conda) {
        return;
    }
    const condaEnv = await conda.getCondaEnvironment(environment.executable.uri?.fsPath);
    if (!condaEnv) {
        return;
    }
    const cmd = await conda.getRunPythonArgs(condaEnv, true, false);
    if (!cmd) {
        return;
    }
    return { command: cmd[0], args: cmd.slice(1) };
}
