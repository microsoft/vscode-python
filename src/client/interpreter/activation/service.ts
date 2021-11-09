// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';

import { IWorkspaceService } from '../../common/application/types';
import { PYTHON_WARNINGS } from '../../common/constants';
import { IPlatformService } from '../../common/platform/types';
import * as internalScripts from '../../common/process/internal/scripts';
import { ExecutionResult, IProcessServiceFactory } from '../../common/process/types';
import { ITerminalHelper, TerminalShellType } from '../../common/terminal/types';
import { ICurrentProcess, IDisposable, Resource } from '../../common/types';
import { sleep } from '../../common/utils/async';
import { InMemoryCache } from '../../common/utils/cacheUtils';
import { OSType } from '../../common/utils/platform';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IInterpreterService } from '../contracts';
import { IEnvironmentActivationService } from './types';
import { TraceOptions } from '../../logging/types';
import {
    traceDecoratorError,
    traceDecoratorVerbose,
    traceError,
    traceInfo,
    traceVerbose,
    traceWarn,
} from '../../logging';

const ENVIRONMENT_PREFIX = 'e8b39361-0157-4923-80e1-22d70d46dee6';
const CACHE_DURATION = 10 * 60 * 1000;
const ENVIRONMENT_TIMEOUT = 30000;

// The shell under which we'll execute activation scripts.
const defaultShells = {
    [OSType.Windows]: { shell: 'cmd', shellType: TerminalShellType.commandPrompt },
    [OSType.OSX]: { shell: 'bash', shellType: TerminalShellType.bash },
    [OSType.Linux]: { shell: 'bash', shellType: TerminalShellType.bash },
    [OSType.Unknown]: undefined,
};

const condaRetryMessages = [
    'The process cannot access the file because it is being used by another process',
    'The directory is not empty',
];

/**
 * This class exists so that the environment variable fetching can be cached in between tests. Normally
 * this cache resides in memory for the duration of the EnvironmentActivationService's lifetime, but in the case
 * of our functional tests, we want the cached data to exist outside of each test (where each test will destroy the EnvironmentActivationService)
 * This gives each test a 3 or 4 second speedup.
 */
export class EnvironmentActivationServiceCache {
    private static useStatic = false;
    private static staticMap = new Map<string, InMemoryCache<NodeJS.ProcessEnv | undefined>>();
    private normalMap = new Map<string, InMemoryCache<NodeJS.ProcessEnv | undefined>>();

    public static forceUseStatic() {
        EnvironmentActivationServiceCache.useStatic = true;
    }
    public static forceUseNormal() {
        EnvironmentActivationServiceCache.useStatic = false;
    }
    public get(key: string): InMemoryCache<NodeJS.ProcessEnv | undefined> | undefined {
        if (EnvironmentActivationServiceCache.useStatic) {
            return EnvironmentActivationServiceCache.staticMap.get(key);
        }
        return this.normalMap.get(key);
    }

    public set(key: string, value: InMemoryCache<NodeJS.ProcessEnv | undefined>) {
        if (EnvironmentActivationServiceCache.useStatic) {
            EnvironmentActivationServiceCache.staticMap.set(key, value);
        } else {
            this.normalMap.set(key, value);
        }
    }

    public delete(key: string) {
        if (EnvironmentActivationServiceCache.useStatic) {
            EnvironmentActivationServiceCache.staticMap.delete(key);
        } else {
            this.normalMap.delete(key);
        }
    }

    public clear() {
        // Don't clear during a test as the environment isn't going to change
        if (!EnvironmentActivationServiceCache.useStatic) {
            this.normalMap.clear();
        }
    }
}

@injectable()
export class EnvironmentActivationService implements IEnvironmentActivationService, IDisposable {
    private readonly disposables: IDisposable[] = [];
    private readonly activatedEnvVariablesCache = new EnvironmentActivationServiceCache();
    constructor(
        @inject(ITerminalHelper) private readonly helper: ITerminalHelper,
        @inject(IPlatformService) private readonly platform: IPlatformService,
        @inject(IProcessServiceFactory) private processServiceFactory: IProcessServiceFactory,
        @inject(ICurrentProcess) private currentProcess: ICurrentProcess,
        @inject(IWorkspaceService) private workspace: IWorkspaceService,
        @inject(IInterpreterService) private interpreterService: IInterpreterService,
        @inject(IEnvironmentVariablesProvider) private readonly envVarsService: IEnvironmentVariablesProvider,
    ) {
        this.envVarsService.onDidEnvironmentVariablesChange(
            () => this.activatedEnvVariablesCache.clear(),
            this,
            this.disposables,
        );

        this.interpreterService.onDidChangeInterpreter(
            () => this.activatedEnvVariablesCache.clear(),
            this,
            this.disposables,
        );
    }

    public dispose(): void {
        this.disposables.forEach((d) => d.dispose());
    }
    @traceDecoratorVerbose('getActivatedEnvironmentVariables', TraceOptions.Arguments)
    @captureTelemetry(EventName.PYTHON_INTERPRETER_ACTIVATION_ENVIRONMENT_VARIABLES, { failed: false }, true)
    public async getActivatedEnvironmentVariables(
        resource: Resource,
        interpreter?: PythonEnvironment,
        allowExceptions?: boolean,
    ): Promise<NodeJS.ProcessEnv | undefined> {
        // Cache key = resource + interpreter.
        const workspaceKey = this.workspace.getWorkspaceFolderIdentifier(resource);
        const interpreterPath = this.platform.isWindows ? interpreter?.path.toLowerCase() : interpreter?.path;
        const cacheKey = `${workspaceKey}_${interpreterPath}`;

        if (this.activatedEnvVariablesCache.get(cacheKey)?.hasData) {
            return this.activatedEnvVariablesCache.get(cacheKey)!.data;
        }

        // Cache only if successful, else keep trying & failing if necessary.
        const cache = new InMemoryCache<NodeJS.ProcessEnv | undefined>(CACHE_DURATION);
        return this.getActivatedEnvironmentVariablesImpl(resource, interpreter, allowExceptions).then((vars) => {
            cache.data = vars;
            this.activatedEnvVariablesCache.set(cacheKey, cache);
            return vars;
        });
    }

    public async getActivatedEnvironmentVariablesImpl(
        resource: Resource,
        interpreter?: PythonEnvironment,
        allowExceptions?: boolean,
    ): Promise<NodeJS.ProcessEnv | undefined> {
        const shellInfo = defaultShells[this.platform.osType];
        if (!shellInfo) {
            return;
        }
        let isPossiblyCondaEnv = false;
        try {
            const activationCommands = await this.helper.getEnvironmentActivationShellCommands(
                resource,
                shellInfo.shellType,
                interpreter,
            );
            traceVerbose(`Activation Commands received ${activationCommands} for shell ${shellInfo.shell}`);
            if (!activationCommands || !Array.isArray(activationCommands) || activationCommands.length === 0) {
                return;
            }
            isPossiblyCondaEnv = activationCommands.join(' ').toLowerCase().includes('conda');
            // Run the activate command collect the environment from it.
            const activationCommand = this.fixActivationCommands(activationCommands).join(' && ');
            const processService = await this.processServiceFactory.create(resource);
            const customEnvVars = await this.envVarsService.getEnvironmentVariables(resource);
            const hasCustomEnvVars = Object.keys(customEnvVars).length;
            const env = hasCustomEnvVars ? customEnvVars : { ...this.currentProcess.env };

            // Make sure python warnings don't interfere with getting the environment. However
            // respect the warning in the returned values
            const oldWarnings = env[PYTHON_WARNINGS];
            env[PYTHON_WARNINGS] = 'ignore';

            traceVerbose(`${hasCustomEnvVars ? 'Has' : 'No'} Custom Env Vars`);

            // In order to make sure we know where the environment output is,
            // put in a dummy echo we can look for
            const [args, parse] = internalScripts.printEnvVariables();
            args.forEach((arg, i) => {
                args[i] = arg.toCommandArgument();
            });
            const command = `${activationCommand} && echo '${ENVIRONMENT_PREFIX}' && python ${args.join(' ')}`;
            traceVerbose(`Activating Environment to capture Environment variables, ${command}`);

            // Do some wrapping of the call. For two reasons:
            // 1) Conda activate can hang on certain systems. Fail after 30 seconds.
            // See the discussion from hidesoon in this issue: https://github.com/Microsoft/vscode-python/issues/4424
            // His issue is conda never finishing during activate. This is a conda issue, but we
            // should at least tell the user.
            // 2) Retry because of this issue here: https://github.com/microsoft/vscode-python/issues/9244
            // This happens on AzDo machines a bunch when using Conda (and we can't dictate the conda version in order to get the fix)
            let result: ExecutionResult<string> | undefined;
            let tryCount = 1;
            let returnedEnv: NodeJS.ProcessEnv | undefined;
            while (!result) {
                try {
                    result = await processService.shellExec(command, {
                        env,
                        shell: shellInfo.shell,
                        timeout: ENVIRONMENT_TIMEOUT,
                        maxBuffer: 1000 * 1000,
                        throwOnStdErr: false,
                    });

                    try {
                        // Try to parse the output, even if we have errors in stderr, its possible they are false positives.
                        // If variables are available, then ignore errors (but log them).
                        returnedEnv = this.parseEnvironmentOutput(result.stdout, parse);
                    } catch (ex) {
                        if (!result.stderr) {
                            throw ex;
                        }
                    }
                    if (result.stderr) {
                        if (returnedEnv) {
                            traceWarn('Got env variables but with errors', result.stderr);
                        } else {
                            throw new Error(`StdErr from ShellExec, ${result.stderr} for ${command}`);
                        }
                    }
                } catch (exc) {
                    // Special case. Conda for some versions will state a file is in use. If
                    // that's the case, wait and try again. This happens especially on AzDo
                    const excString = exc.toString();
                    if (condaRetryMessages.find((m) => excString.includes(m)) && tryCount < 10) {
                        traceInfo(`Conda is busy, attempting to retry ...`);
                        result = undefined;
                        tryCount += 1;
                        await sleep(500);
                    } else {
                        throw exc;
                    }
                }
            }

            // Put back the PYTHONWARNINGS value
            if (oldWarnings && returnedEnv) {
                returnedEnv[PYTHON_WARNINGS] = oldWarnings;
            } else if (returnedEnv) {
                delete returnedEnv[PYTHON_WARNINGS];
            }
            return returnedEnv;
        } catch (e) {
            traceError('getActivatedEnvironmentVariables', e);
            sendTelemetryEvent(EventName.ACTIVATE_ENV_TO_GET_ENV_VARS_FAILED, undefined, {
                isPossiblyCondaEnv,
                terminal: shellInfo.shellType,
            });

            // Some callers want this to bubble out, others don't
            if (allowExceptions) {
                throw e;
            }
        }
    }

    protected fixActivationCommands(commands: string[]): string[] {
        // Replace 'source ' with '. ' as that works in shell exec
        return commands.map((cmd) => cmd.replace(/^source\s+/, '. '));
    }
    @traceDecoratorError('Failed to parse Environment variables')
    @traceDecoratorVerbose('parseEnvironmentOutput', TraceOptions.None)
    protected parseEnvironmentOutput(output: string, parse: (out: string) => NodeJS.ProcessEnv | undefined) {
        output = output.substring(output.indexOf(ENVIRONMENT_PREFIX) + ENVIRONMENT_PREFIX.length);
        const js = output.substring(output.indexOf('{')).trim();
        return parse(js);
    }
}
