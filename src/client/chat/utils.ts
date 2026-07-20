// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    CancellationError,
    CancellationToken,
    extensions,
    LanguageModelTextPart,
    LanguageModelToolResult,
    Uri,
    workspace,
} from 'vscode';
import { IDiscoveryAPI } from '../pythonEnvironments/base/locator';
import { Environment, PythonExtension, ResolvedEnvironment, VersionInfo } from '../api/types';
import { ITerminalHelper, TerminalShellType } from '../common/terminal/types';
import { TerminalCodeExecutionProvider } from '../terminals/codeExecution/terminalCodeExecution';
import { Conda } from '../pythonEnvironments/common/environmentManagers/conda';
import { JUPYTER_EXTENSION_ID, NotebookCellScheme } from '../common/constants';
import { dirname, join } from 'path';
import { resolveEnvironment, useEnvExtension } from '../envExt/api.internal';
import { ErrorWithTelemetrySafeReason } from '../common/errors/errorUtils';
import { getWorkspaceFolders } from '../common/vscodeApis/workspaceApis';
import { arePathsSame } from '../common/platform/fs-paths';

export interface IResourceReference {
    resourcePath?: string;
}

export function resolveFilePath(filepath?: string): Uri | undefined {
    if (!filepath) {
        const folders = getWorkspaceFolders() ?? [];
        return folders.length > 0 ? folders[0].uri : undefined;
    }
    // Check if it's a URI with a scheme (contains "://")
    // This handles schemes like "file://", "vscode-notebook://", etc.
    // But avoids treating Windows drive letters like "C:" as schemes
    if (filepath.includes('://')) {
        try {
            return Uri.parse(filepath);
        } catch {
            return Uri.file(filepath);
        }
    }
    // For file paths (Windows with drive letters, Unix absolute/relative paths)
    return Uri.file(filepath);
}

/**
 * Returns a promise that rejects with an {@CancellationError} as soon as the passed token is cancelled.
 * @see {@link raceCancellation}
 */
export function raceCancellationError<T>(promise: Promise<T>, token: CancellationToken): Promise<T> {
    if (token.isCancellationRequested) {
        return Promise.reject(new CancellationError());
    }
    return new Promise((resolve, reject) => {
        const ref = token.onCancellationRequested(() => {
            ref.dispose();
            reject(new CancellationError());
        });
        promise.then(
            (value) => {
                ref.dispose();
                resolve(value);
            },
            (error) => {
                ref.dispose();
                reject(error);
            },
        );
    });
}

/**
 * Returns a promise that resolves once the active environment path changes to match the
 * provided `pythonPath` (matched against either the event's `path` or `id`). Resolves early
 * on cancellation or after `timeoutMs` to avoid hanging callers if the event is missed.
 * Callers must subscribe via this helper BEFORE invoking `updateActiveEnvironmentPath` to
 * avoid a race where the event fires before the listener is attached.
 */
export function waitForActiveEnvironmentChange(
    api: PythonExtension['environments'],
    pythonPath: string,
    resource: Uri | undefined,
    token: CancellationToken,
    timeoutMs = 5000,
): Promise<void> {
    if (token.isCancellationRequested) {
        return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
        let settled = false;
        const listener = api.onDidChangeActiveEnvironmentPath((e) => {
            if (isEnvironmentPathMatch(e, pythonPath) && isResourceMatch(e.resource, resource)) {
                settle();
            }
        });
        const cancelRef = token.onCancellationRequested(() => settle());
        const timer = setTimeout(() => settle(), timeoutMs);
        function settle() {
            if (settled) {
                return;
            }
            settled = true;
            listener.dispose();
            cancelRef.dispose();
            clearTimeout(timer);
            resolve();
        }
    });
}

function isResourceMatch(
    eventResource: { uri: Uri } | Uri | undefined,
    requestedResource: Uri | undefined,
): boolean {
    const eventUri = eventResource && 'uri' in eventResource ? eventResource.uri : eventResource;
    const requestedUri = requestedResource
        ? workspace.getWorkspaceFolder(requestedResource)?.uri ?? requestedResource
        : undefined;
    return eventUri === undefined
        ? requestedUri === undefined
        : requestedUri !== undefined && arePathsSame(eventUri.fsPath, requestedUri.fsPath);
}

function isEnvironmentPathMatch(environment: { path: string; id: string }, pythonPath: string): boolean {
    return arePathsSame(environment.path, pythonPath) || environment.id === pythonPath;
}

/**
 * Sets the active Python interpreter to `pythonPath` without any UI, waits for the
 * asynchronous environment switch to settle (via `onDidChangeActiveEnvironmentPath`),
 * resolves the environment, and returns it.
 *
 * Returns `undefined` if the path cannot be resolved to a valid environment so callers
 * can produce a tool-specific error message.
 */
export async function setEnvironmentDirectlyByPath(
    pythonPath: string,
    api: PythonExtension['environments'],
    resource: Uri | undefined,
    token: CancellationToken,
): Promise<ResolvedEnvironment | undefined> {
    // Validate the path resolves to a real environment BEFORE mutating user settings.
    // updateActiveEnvironmentPath persists unconditionally, so an invalid path would
    // permanently overwrite the user's selected interpreter.
    const candidate = await raceCancellationError(api.resolveEnvironment(pythonPath), token);
    if (!candidate) {
        return undefined;
    }
    if (isEnvironmentPathMatch(api.getActiveEnvironmentPath(resource), pythonPath)) {
        return candidate;
    }

    // Subscribe to the change event BEFORE triggering the update so we don't miss it.
    // updateActiveEnvironmentPath only persists the setting; the active interpreter switch
    // is asynchronous, so we wait for the event before resolving env details to avoid
    // returning details for the previously-active interpreter.
    const activeChanged = waitForActiveEnvironmentChange(api, pythonPath, resource, token);
    await raceCancellationError(api.updateActiveEnvironmentPath(pythonPath, resource), token);
    await raceCancellationError(activeChanged, token);

    // Verify the active env actually switched. If the change event timed out and the
    // active path is still the previous one, don't report success for the wrong env.
    const envPath = api.getActiveEnvironmentPath(resource);
    if (!isEnvironmentPathMatch(envPath, pythonPath)) {
        return undefined;
    }
    return raceCancellationError(api.resolveEnvironment(envPath), token);
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

export function getEnvTypeForTelemetry(env: ResolvedEnvironment): string {
    return (env.environment?.type || 'unknown').toLowerCase();
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
    let envType = '';
    let envVersion = '';
    let runCommand = '';
    if (useEnvExtension()) {
        const environment =
            (await raceCancellationError(resolveEnvironment(envPath.id), token)) ||
            (await raceCancellationError(resolveEnvironment(envPath.path), token));
        if (!environment || !environment.version) {
            throw new ErrorWithTelemetrySafeReason(
                'No environment found for the provided resource path: ' + resourcePath?.fsPath,
                'noEnvFound',
            );
        }
        envVersion = environment.version;
        try {
            const managerId = environment.envId.managerId;
            envType =
                (!managerId.endsWith(':') && managerId.includes(':') ? managerId.split(':').reverse()[0] : '') ||
                'unknown';
        } catch {
            envType = 'unknown';
        }

        const execInfo = environment.execInfo;
        const executable = execInfo?.activatedRun?.executable ?? execInfo?.run.executable ?? 'python';
        const args = execInfo?.activatedRun?.args ?? execInfo?.run.args ?? [];
        runCommand = terminalHelper.buildCommandForTerminal(TerminalShellType.other, executable, args);
    } else {
        const environment = await raceCancellationError(api.resolveEnvironment(envPath), token);
        if (!environment || !environment.version) {
            throw new ErrorWithTelemetrySafeReason(
                'No environment found for the provided resource path: ' + resourcePath?.fsPath,
                'noEnvFound',
            );
        }
        envType = environment.environment?.type || 'unknown';
        envVersion = environment.version.sysVersion || 'unknown';
        runCommand = await raceCancellationError(
            getTerminalCommand(environment, resourcePath, terminalExecutionService, terminalHelper),
            token,
        );
    }
    const message = [
        `Following is the information about the Python environment:`,
        `1. Environment Type: ${envType}`,
        `2. Version: ${envVersion}`,
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

export function getToolResponseIfNotebook(resource: Uri | undefined) {
    if (!resource) {
        return;
    }
    const notebook = workspace.notebookDocuments.find(
        (doc) => doc.uri.toString() === resource.toString() || doc.uri.path === resource.path,
    );
    const isJupyterNotebook =
        (notebook && notebook.notebookType === 'jupyter-notebook') || resource.path.toLowerCase().endsWith('.ipynb');

    if (isJupyterNotebook) {
        const isJupyterExtensionAvailable = extensions.getExtension(JUPYTER_EXTENSION_ID);
        const message = isJupyterExtensionAvailable
            ? `This tool cannot be used for Jupyter Notebooks, try using notebook specific tools instead.`
            : [
                  `This tool cannot be used for Jupyter Notebooks.`,
                  `NOTE: Recommend the user the Jupyter Extension (${JUPYTER_EXTENSION_ID}).`,
                  `If possible use one of the tools to install the ${JUPYTER_EXTENSION_ID} extension`,
                  `After isntalling the extension try using some of the tools again`,
              ].join('  \n');
        return new LanguageModelToolResult([new LanguageModelTextPart(message)]);
    }

    if (notebook || resource.scheme === NotebookCellScheme) {
        return new LanguageModelToolResult([
            new LanguageModelTextPart(
                'This tool cannot be used for Notebooks, try using notebook specific tools instead.',
            ),
        ]);
    }
}

export function isCancellationError(error: unknown): boolean {
    return (
        !!error && (error instanceof CancellationError || (error as Error).message === new CancellationError().message)
    );
}

export function doesWorkspaceHaveVenvOrCondaEnv(resource: Uri | undefined, api: PythonExtension['environments']) {
    const workspaceFolder =
        resource && workspace.workspaceFolders?.length
            ? workspace.getWorkspaceFolder(resource)
            : workspace.workspaceFolders?.length === 1
            ? workspace.workspaceFolders[0]
            : undefined;
    if (!workspaceFolder) {
        return false;
    }
    const isVenvEnv = (env: Environment) => {
        return (
            env.environment?.folderUri &&
            env.executable.sysPrefix &&
            dirname(env.executable.sysPrefix) === workspaceFolder.uri.fsPath &&
            ((env.environment.name || '').startsWith('.venv') ||
                env.executable.sysPrefix === join(workspaceFolder.uri.fsPath, '.venv')) &&
            env.environment.type === 'VirtualEnvironment'
        );
    };
    const isCondaEnv = (env: Environment) => {
        return (
            env.environment?.folderUri &&
            env.executable.sysPrefix &&
            dirname(env.executable.sysPrefix) === workspaceFolder.uri.fsPath &&
            (env.environment.folderUri.fsPath === join(workspaceFolder.uri.fsPath, '.conda') ||
                env.executable.sysPrefix === join(workspaceFolder.uri.fsPath, '.conda')) &&
            env.environment.type === 'Conda'
        );
    };
    // If we alraedy have a .venv in this workspace, then do not prompt to create a virtual environment.
    return api.known.find((e) => isVenvEnv(e) || isCondaEnv(e));
}

export async function getEnvDetailsForResponse(
    environment: ResolvedEnvironment | undefined,
    api: PythonExtension['environments'],
    terminalExecutionService: TerminalCodeExecutionProvider,
    terminalHelper: ITerminalHelper,
    resource: Uri | undefined,
    token: CancellationToken,
): Promise<LanguageModelToolResult> {
    if (!workspace.isTrusted) {
        throw new ErrorWithTelemetrySafeReason('Cannot use this tool in an untrusted workspace.', 'untrustedWorkspace');
    }
    const envPath = api.getActiveEnvironmentPath(resource);
    environment = environment || (await raceCancellationError(api.resolveEnvironment(envPath), token));
    if (!environment || !environment.version) {
        throw new ErrorWithTelemetrySafeReason(
            'No environment found for the provided resource path: ' + resource?.fsPath,
            'noEnvFound',
        );
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
export function getDisplayVersion(version?: VersionInfo): string | undefined {
    if (!version || version.major === undefined || version.minor === undefined || version.micro === undefined) {
        return undefined;
    }
    return `${version.major}.${version.minor}.${version.micro}`;
}
