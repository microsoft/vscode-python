// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationError, CancellationToken, Uri, workspace } from 'vscode';
import { IDiscoveryAPI } from '../pythonEnvironments/base/locator';
import { PythonExtension, ResolvedEnvironment } from '../api/types';
import { ITerminalHelper, TerminalShellType } from '../common/terminal/types';
import { TerminalCodeExecutionProvider } from '../terminals/codeExecution/terminalCodeExecution';
import { Conda } from '../pythonEnvironments/common/environmentManagers/conda';

export function resolveFilePath(filepath?: string): Uri | undefined {
    if (!filepath) {
        return workspace.workspaceFolders ? workspace.workspaceFolders[0].uri : undefined;
    }
    // starts with a scheme
    try {
        return Uri.parse(filepath);
    } catch (e) {
        return Uri.file(filepath);
    }
}

/**
 * Returns a promise that rejects with an {@CancellationError} as soon as the passed token is cancelled.
 * @see {@link raceCancellation}
 */
export function raceCancellationError<T>(promise: Promise<T>, token: CancellationToken): Promise<T> {
    return new Promise((resolve, reject) => {
        const ref = token.onCancellationRequested(() => {
            ref.dispose();
            reject(new CancellationError());
        });
        promise.then(resolve, reject).finally(() => ref.dispose());
    });
}

export async function getEnvDisplayName(
    discovery: IDiscoveryAPI,
    resource: Uri | undefined,
    api: PythonExtension['environments'],
) {
    try {
        const envPath = api.getActiveEnvironmentPath(resource);
        const env = await discovery.resolveEnv(envPath.path);
        return env?.display || env?.name;
    } catch {
        return;
    }
}

export function isCondaEnv(env: ResolvedEnvironment) {
    return (env.environment?.type || '').toLowerCase() === 'conda';
}

export async function getEnvironmentDetails(
    resourcePath: Uri | undefined,
    api: PythonExtension['environments'],
    terminalExecutionService: TerminalCodeExecutionProvider,
    terminalHelper: ITerminalHelper,
    packages: string | undefined,
    token: CancellationToken,
): Promise<string> {
    // environment
    const envPath = api.getActiveEnvironmentPath(resourcePath);
    const environment = await raceCancellationError(api.resolveEnvironment(envPath), token);
    if (!environment || !environment.version) {
        throw new Error('No environment found for the provided resource path: ' + resourcePath?.fsPath);
    }
    const runCommand = await raceCancellationError(
        getTerminalCommand(environment, resourcePath, terminalExecutionService, terminalHelper),
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
        packages ? `4. ${packages}` : '',
    ];
    return message.join('\n');
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
