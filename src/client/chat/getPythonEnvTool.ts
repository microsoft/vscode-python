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
import { IProcessService, IProcessServiceFactory, IPythonExecutionFactory } from '../common/process/types';
import { raceCancellationError } from './utils';
import { resolveFilePath } from './utils';
import { parsePipList } from './pipListUtils';
import { Conda } from '../pythonEnvironments/common/environmentManagers/conda';
import { traceError } from '../logging';

export interface IResourceReference {
    resourcePath: string;
}

interface EnvironmentInfo {
    type: string; // e.g. conda, venv, virtualenv, sys
    version: string;
    runCommand: string;
    packages: string[] | string; //include versions too
}

/**
 * A tool to get the information about the Python environment.
 */
export class GetEnvironmentInfoTool implements LanguageModelTool<IResourceReference> {
    private readonly terminalExecutionService: TerminalCodeExecutionProvider;
    private readonly pythonExecFactory: IPythonExecutionFactory;
    private readonly processServiceFactory: IProcessServiceFactory;
    public static readonly toolName = 'python_environment';
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

        // environment info set to default values
        const envInfo: EnvironmentInfo = {
            type: 'no type found',
            version: 'no version found',
            packages: 'no packages found',
            runCommand: 'no run command found',
        };

        try {
            // environment
            const envPath = this.api.getActiveEnvironmentPath(resourcePath);
            const environment = await raceCancellationError(this.api.resolveEnvironment(envPath), token);
            if (!environment || !environment.version) {
                throw new Error('No environment found for the provided resource path: ' + resourcePath.fsPath);
            }
            const cmd = await raceCancellationError(
                this.terminalExecutionService.getExecutableInfo(resourcePath),
                token,
            );
            const executable = cmd.pythonExecutable;
            envInfo.runCommand = cmd.args.length > 0 ? `${cmd.command} ${cmd.args.join(' ')}` : executable;
            envInfo.version = environment.version.sysVersion;

            const isConda = (environment.environment?.type || '').toLowerCase() === 'conda';
            envInfo.packages = isConda
                ? await raceCancellationError(
                      listCondaPackages(
                          this.pythonExecFactory,
                          environment,
                          resourcePath,
                          await raceCancellationError(this.processServiceFactory.create(resourcePath), token),
                      ),
                      token,
                  )
                : await raceCancellationError(listPipPackages(this.pythonExecFactory, resourcePath), token);

            // format and return
            return new LanguageModelToolResult([BuildEnvironmentInfoContent(envInfo)]);
        } catch (error) {
            if (error instanceof CancellationError) {
                throw error;
            }
            const errorMessage: string = `An error occurred while fetching environment information: ${error}`;
            const partialContent = BuildEnvironmentInfoContent(envInfo);
            return new LanguageModelToolResult([
                new LanguageModelTextPart(`${errorMessage}\n\n${partialContent.value}`),
            ]);
        }
    }

    async prepareInvocation?(
        _options: LanguageModelToolInvocationPrepareOptions<IResourceReference>,
        _token: CancellationToken,
    ): Promise<PreparedToolInvocation> {
        return {
            invocationMessage: l10n.t('Fetching Python environment information'),
        };
    }
}

function BuildEnvironmentInfoContent(envInfo: EnvironmentInfo): LanguageModelTextPart {
    // Create a formatted string that looks like JSON but preserves comments
    let envTypeDescriptor: string = `This environment is managed by ${envInfo.type} environment manager. Use the install tool to install packages into this environment.`;

    // TODO: If this is setup as python.defaultInterpreterPath, then do not include this message.
    if (envInfo.type === 'system') {
        envTypeDescriptor =
            'System pythons are pythons that ship with the OS or are installed globally. These python installs may be used by the OS for running services and core functionality. Confirm with the user before installing packages into this environment, as it can lead to issues with any services on the OS.';
    }
    const content = `{
    // ${JSON.stringify(envTypeDescriptor)}
  "environmentType": ${JSON.stringify(envInfo.type)},
  // Python version of the environment
  "pythonVersion": ${JSON.stringify(envInfo.version)},
  // Use this command to run Python script or code in the terminal.
  "runCommand": ${JSON.stringify(envInfo.runCommand)},
  // Installed Python packages, each in the format <name> or <name> (<version>). The version may be omitted if unknown. Returns an empty array if no packages are installed.
  "packages": ${JSON.stringify(Array.isArray(envInfo.packages) ? envInfo.packages : envInfo.packages, null, 2)}
}`;

    return new LanguageModelTextPart(content);
}

async function listPipPackages(execFactory: IPythonExecutionFactory, resource: Uri) {
    // Add option --format to subcommand list of pip  cache, with abspath choice to output the full path of a wheel file. (#8355)
    // Added in 202. Thats almost 5 years ago. When Python 3.8 was released.
    const exec = await execFactory.createActivatedEnvironment({ allowEnvironmentFetchExceptions: true, resource });
    const output = await exec.execModule('pip', ['list'], { throwOnStdErr: false, encoding: 'utf8' });
    return parsePipList(output.stdout).map((pkg) => (pkg.version ? `${pkg.name} (${pkg.version})` : pkg.name));
}

async function listCondaPackages(
    execFactory: IPythonExecutionFactory,
    env: ResolvedEnvironment,
    resource: Uri,
    processService: IProcessService,
) {
    const conda = await Conda.getConda();
    if (!conda) {
        traceError('Conda is not installed, falling back to pip packages');
        return listPipPackages(execFactory, resource);
    }
    if (!env.executable.uri) {
        traceError('Conda environment executable not found, falling back to pip packages');
        return listPipPackages(execFactory, resource);
    }
    const condaEnv = await conda.getCondaEnvironment(env.executable.uri.fsPath);
    if (!condaEnv) {
        traceError('Conda environment not found, falling back to pip packages');
        return listPipPackages(execFactory, resource);
    }
    const cmd = await conda.getListPythonPackagesArgs(condaEnv, true);
    if (!cmd) {
        traceError('Conda list command not found, falling back to pip packages');
        return listPipPackages(execFactory, resource);
    }
    const output = await processService.exec(cmd[0], cmd.slice(1), { shell: true });
    if (!output.stdout) {
        traceError('Unable to get conda packages, falling back to pip packages');
        return listPipPackages(execFactory, resource);
    }
    const content = output.stdout.split(/\r?\n/).filter((l) => !l.startsWith('#'));
    const packages: string[] = [];
    content.forEach((l) => {
        const parts = l.split(' ').filter((p) => p.length > 0);
        if (parts.length === 3) {
            packages.push(`${parts[0]} (${parts[1]})`);
        }
    });
    return packages;
}
