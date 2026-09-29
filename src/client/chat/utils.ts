// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    CancellationError,
    CancellationToken,
    extensions,
    l10n,
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
import { dirname, isAbsolute, join } from 'path';
import { stat } from 'fs-extra';
import {
    ENVS_EXTENSION_ID,
    getEnvExtApi,
    getPythonToolsApi,
    resolveEnvironment,
    useEnvExtension,
} from '../envExt/api.internal';
import { PythonToolResult, PythonToolsApi } from '../envExt/pythonToolsApi';
import { PythonEnvironment } from '../envExt/types';
import { ErrorWithTelemetrySafeReason } from '../common/errors/errorUtils';
import { getWorkspaceFolder, getWorkspaceFolders } from '../common/vscodeApis/workspaceApis';
import { arePathsSame } from '../common/platform/fs-paths';
import { showWarningMessage } from '../common/vscodeApis/windowApis';
import { executeCommand } from '../common/vscodeApis/commandApis';
import { traceError } from '../logging';

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

/** Applies the consumer's workspace default without replacing explicit input. */
export function getPythonToolResourcePath(
    resourcePath: string | undefined,
    resource: Uri | undefined,
): string | undefined {
    return resourcePath === undefined || resourcePath === '' ? resource?.fsPath : resourcePath;
}

/**
 * Whether a workspace-scoped Python Environments route applies. Read-only queries keep their
 * previous no-workspace behavior. Configure and install must check the private capability even
 * without a workspace so its validation cannot be bypassed by a public API fallback.
 */
export function usePythonToolsRoute(): boolean {
    return useEnvExtension() && (getWorkspaceFolders() ?? []).length > 0;
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

function isResourceMatch(eventResource: { uri: Uri } | Uri | undefined, requestedResource: Uri | undefined): boolean {
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
 * Sets the active Python interpreter to `pythonPath` through the active backend, waits for the
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
    if (token.isCancellationRequested) {
        throw new CancellationError();
    }
    // Resolve before persisting a selection.
    const candidate = await raceCancellationError(api.resolveEnvironment(pythonPath), token);
    if (!candidate) {
        return undefined;
    }
    const usingEnvironments = useEnvExtension();
    let selectEnvironment: (() => Promise<void>) | undefined;
    if (usingEnvironments) {
        // The Python path updater does not persist the Environments backend's selection.
        const backend = await raceCancellationError(getEnvExtApi(), token);
        if (!candidate.executable.uri) {
            return undefined;
        }
        const environment = await raceCancellationError(backend.resolveEnvironment(candidate.executable.uri), token);
        if (!environment) {
            return undefined;
        }
        selectEnvironment = () => backend.setEnvironment(resource, environment);
    }
    const alreadyActive = isEnvironmentPathMatch(api.getActiveEnvironmentPath(resource), pythonPath);
    if (alreadyActive && !usingEnvironments) {
        return candidate;
    }

    // Subscribe before selecting; the Python API's active-path cache updates asynchronously.
    const activeChanged = alreadyActive
        ? Promise.resolve()
        : waitForActiveEnvironmentChange(api, pythonPath, resource, token);
    if (token.isCancellationRequested) {
        throw new CancellationError();
    }
    if (selectEnvironment) {
        await raceCancellationError(selectEnvironment(), token);
    }
    if (!usingEnvironments || !isEnvironmentPathMatch(api.getActiveEnvironmentPath(resource), pythonPath)) {
        if (token.isCancellationRequested) {
            throw new CancellationError();
        }
        await raceCancellationError(api.updateActiveEnvironmentPath(pythonPath, resource), token);
    }
    await raceCancellationError(activeChanged, token);

    // Do not describe the previous interpreter while the Python cache catches up.
    const envPath = api.getActiveEnvironmentPath(resource);
    const selected = isEnvironmentPathMatch(envPath, pythonPath)
        ? await raceCancellationError(api.resolveEnvironment(envPath), token)
        : undefined;
    if (!selected && usingEnvironments) {
        throw new ErrorWithTelemetrySafeReason(
            l10n.t(
                'The environment selection was saved, but Python has not refreshed its active interpreter information yet. Retry the environment query after discovery finishes.',
            ),
            'selectionPending',
        );
    }
    return selected;
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

/** Classifies built-in managers without recording arbitrary extension-provided IDs. */
export function getPythonToolTelemetry(
    environment: PythonEnvironment | undefined,
): { envType: string; installerType: string } {
    const id = environment?.envId?.managerId;
    switch (typeof id === 'string' ? id.toLowerCase() : '') {
        case 'ms-python.python:conda':
            return { envType: 'conda', installerType: 'conda' };
        case 'ms-python.python:poetry':
            return { envType: 'virtualenvironment', installerType: 'poetry' };
        case 'ms-python.python:venv':
        case 'ms-python.python:pipenv':
        case 'ms-python.python:pyenv':
        case 'ms-python.python:inline-script':
            return { envType: 'virtualenvironment', installerType: 'pip' };
        case 'ms-python.python:system':
            return { envType: 'unknown', installerType: 'pip' };
        default:
            return { envType: 'unknown', installerType: 'unknown' };
    }
}

let incompatibleProviderNotified = false;

/** Resets the one-shot notification guard. Test-only. */
export function resetIncompatibleProviderNotification(): void {
    incompatibleProviderNotified = false;
}

function notifyIncompatibleProviderOnce(): void {
    if (incompatibleProviderNotified) {
        return;
    }
    incompatibleProviderNotified = true;
    const update = l10n.t('Update Python Environments');
    void Promise.resolve()
        .then(() =>
            showWarningMessage(
                l10n.t(
                    'Python environment tools are using compatibility mode and may show prompts. Update the Python Environments extension for noninteractive tools.',
                ),
                update,
            ),
        )
        .then(
            (selection) => {
                if (selection === update) {
                    void executeCommand('extension.open', ENVS_EXTENSION_ID);
                }
            },
            (error) => traceError('Failed to show Python Environments compatibility notification:', error),
        );
}

export const PYTHON_TOOLS_UNAVAILABLE = Symbol('pythonToolsUnavailable');

/** Guards hidden interactive tools only when the compatible noninteractive route exists. */
export async function hasPythonToolsApi(token: CancellationToken): Promise<boolean> {
    if (!useEnvExtension()) {
        return false;
    }
    if (token.isCancellationRequested) {
        throw new CancellationError();
    }
    const api = await raceCancellationError(getPythonToolsApi(), token);
    if (token.isCancellationRequested) {
        throw new CancellationError();
    }
    return !!api;
}

/** Only capability absence permits compatibility routing; operation results never do. */
export async function invokePythonTool(
    invoke: (api: PythonToolsApi) => Promise<PythonToolResult>,
    token: CancellationToken,
): Promise<PythonToolResult | typeof PYTHON_TOOLS_UNAVAILABLE> {
    if (token.isCancellationRequested) {
        throw new CancellationError();
    }
    try {
        const api = await raceCancellationError(getPythonToolsApi(), token);
        if (token.isCancellationRequested) {
            throw new CancellationError();
        }
        if (!api) {
            notifyIncompatibleProviderOnce();
            return PYTHON_TOOLS_UNAVAILABLE;
        }
        return await invoke(api);
    } catch (error) {
        if (isCancellationError(error)) {
            throw error;
        }
        return {
            status: 'error',
            code: 'operationFailed',
            message: l10n.t(
                'Python Environments could not complete the operation: {0}',
                error instanceof Error ? error.message : String(error),
            ),
        };
    }
}

/** Runs the previous Environments integration against a validated, fixed target. */
export async function invokePythonToolCompatibility(
    resourcePath: string | undefined,
    token: CancellationToken,
    invoke: (resource: Uri) => Promise<LanguageModelToolResult>,
): Promise<LanguageModelToolResult> {
    if (token.isCancellationRequested) {
        throw new CancellationError();
    }
    try {
        if (resourcePath === undefined) {
            throw new ErrorWithTelemetrySafeReason(
                l10n.t('Open a workspace folder before running Python environment tools.'),
                'NO_WORKSPACE',
            );
        }
        if (
            typeof resourcePath !== 'string' ||
            !resourcePath.trim() ||
            /[\0\r\n]/.test(resourcePath) ||
            (!/^file:/i.test(resourcePath) && !isAbsolute(resourcePath))
        ) {
            throw new ErrorWithTelemetrySafeReason(
                l10n.t('resourcePath must be an absolute path or file URI.'),
                'INVALID_RESOURCE',
            );
        }
        const resource = /^file:/i.test(resourcePath) ? Uri.parse(resourcePath) : Uri.file(resourcePath);
        if (
            resource.scheme !== 'file' ||
            resource.query ||
            resource.fragment ||
            !isAbsolute(resource.fsPath) ||
            !getWorkspaceFolder(resource)
        ) {
            throw new ErrorWithTelemetrySafeReason(
                l10n.t('Open {0} in a workspace folder before configuring its environment.', resource.fsPath),
                'INVALID_RESOURCE',
            );
        }
        const target = await raceCancellationError(stat(resource.fsPath), token);
        if (!target.isFile() && !target.isDirectory()) {
            throw new ErrorWithTelemetrySafeReason(
                l10n.t('resourcePath must identify a file or directory.'),
                'INVALID_RESOURCE',
            );
        }
        if (token.isCancellationRequested) {
            throw new CancellationError();
        }
        const result = await invoke(resource);
        if (token.isCancellationRequested) {
            throw new CancellationError();
        }
        const response = new LanguageModelToolResult([
            new LanguageModelTextPart(l10n.t('Resource: {0}', resource.fsPath)),
        ]);
        response.content.push(...result.content);
        return response;
    } catch (error) {
        if (isCancellationError(error)) {
            throw error;
        }
        traceError('Python environment compatibility operation failed:', error);
        return getPythonToolResponse({
            status: 'error',
            code: error instanceof ErrorWithTelemetrySafeReason ? error.telemetrySafeReason : 'operationFailed',
            message: error instanceof Error ? error.message : String(error),
            resourcePath: typeof resourcePath === 'string' ? resourcePath : undefined,
        });
    }
}

function quotePowerShellLiteral(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}

function quotePosixLiteral(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`;
}

/** Formats provider results without reporting incomplete details as success. */
export function getPythonToolResponse(
    result: PythonToolResult,
    successMessage?: string,
    includePackages = false,
): LanguageModelToolResult {
    const messages: string[] = [];
    if (!result || (result.status !== 'success' && result.status !== 'error')) {
        return new LanguageModelToolResult([
            new LanguageModelTextPart(l10n.t('Python Environments returned an invalid tools API result.')),
        ]);
    }
    let complete = result.status === 'success';
    if (result.status === 'error') {
        messages.push(l10n.t('Python environment operation failed ({0}): {1}', result.code, result.message));
    }
    if (result.resourcePath !== undefined) {
        messages.push(l10n.t('Resource: {0}', result.resourcePath));
    }
    const environment = result.environment;
    if (environment) {
        const run = environment.execInfo?.run;
        const command = environment.execInfo?.activatedRun ?? run;
        const managerId = environment.envId?.managerId;
        const name = environment.displayName || environment.name;
        if (
            typeof name !== 'string' ||
            !name ||
            typeof environment.version !== 'string' ||
            !environment.version ||
            typeof managerId !== 'string' ||
            !managerId ||
            !run ||
            typeof run.executable !== 'string' ||
            !isAbsolute(run.executable) ||
            !command ||
            typeof command.executable !== 'string' ||
            !isAbsolute(command.executable) ||
            (command.args !== undefined &&
                (!Array.isArray(command.args) || command.args.some((arg) => typeof arg !== 'string')))
        ) {
            complete = false;
            messages.push(
                l10n.t(
                    'Python Environments returned incomplete environment details; no executable command is available.',
                ),
            );
        } else {
            const args = command.args ?? [];
            const powershellPrefix = `& ${[command.executable, ...args].map(quotePowerShellLiteral).join(' ')}`;
            // Git Bash accepts forward slashes in the executable; arguments must retain their original values.
            const posixExecutable =
                process.platform === 'win32' ? command.executable.replace(/\\/g, '/') : command.executable;
            const posixPrefix = [posixExecutable, ...args].map(quotePosixLiteral).join(' ');
            messages.push(
                l10n.t('Following is the information about the Python environment:'),
                l10n.t('Environment: {0}', name),
                l10n.t('Environment Type: {0}', managerId.split(':').pop() || managerId),
                l10n.t('Version: {0}', environment.version),
                l10n.t('Python executable: `{0}`', run.executable),
                l10n.t('PowerShell command prefix: `{0}`', powershellPrefix),
                l10n.t('POSIX shell (including Git Bash) command prefix: `{0}`', posixPrefix),
                l10n.t('Use the prefix for your terminal shell instead of `python`. For example:'),
                l10n.t('PowerShell: `{0} sample.py` or `{0} -c "import sys;..."`', powershellPrefix),
                l10n.t('POSIX shell (including Git Bash): `{0} sample.py` or `{0} -c "import sys;..."`', posixPrefix),
            );
        }
    } else if (result.status === 'success') {
        complete = false;
        messages.push(l10n.t('Python Environments did not return an environment; the operation cannot be confirmed.'));
    }
    if (result.status === 'success' && (includePackages || result.packages !== undefined)) {
        if (
            !Array.isArray(result.packages) ||
            result.packages.some(
                (pkg) =>
                    !pkg ||
                    typeof pkg.name !== 'string' ||
                    !pkg.name ||
                    (pkg.version !== undefined && typeof pkg.version !== 'string'),
            )
        ) {
            complete = false;
            messages.push(l10n.t('Python Environments did not return the requested package information.'));
        } else if (result.packages.length === 0) {
            messages.push(l10n.t('No Python packages are installed.'));
        } else {
            messages.push(
                l10n.t('Installed Python packages (name and version, when known):'),
                ...result.packages.map((pkg) => (pkg.version ? `- ${pkg.name} (${pkg.version})` : `- ${pkg.name}`)),
            );
        }
    }
    if (complete && successMessage) {
        messages.unshift(successMessage);
    }
    if (complete && result.status === 'success' && result.created === true) {
        messages.push(l10n.t('A new Python environment was created.'));
    }
    return new LanguageModelToolResult([new LanguageModelTextPart(messages.join('\n'))]);
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
