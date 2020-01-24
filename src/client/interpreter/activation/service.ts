// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import * as path from 'path';

import { PYTHON_WARNINGS } from '../../common/constants';
import { LogOptions, traceDecorators, traceError, traceVerbose } from '../../common/logger';
import { IPlatformService } from '../../common/platform/types';
import { IProcessServiceFactory } from '../../common/process/types';
import { ITerminalHelper, TerminalShellType } from '../../common/terminal/types';
import { ICurrentProcess, IDisposable, Resource } from '../../common/types';
import { OSType } from '../../common/utils/platform';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { PythonInterpreter } from '../contracts';
import { IEnvironmentActivationService } from './types';

const getEnvironmentPrefix = 'e8b39361-0157-4923-80e1-22d70d46dee6';
export const getEnvironmentTimeout = 30000;

// The shell under which we'll execute activation scripts.
const defaultShells = {
    [OSType.Windows]: { shell: 'cmd', shellType: TerminalShellType.commandPrompt },
    [OSType.OSX]: { shell: 'bash', shellType: TerminalShellType.bash },
    [OSType.Linux]: { shell: 'bash', shellType: TerminalShellType.bash },
    [OSType.Unknown]: undefined
};

@injectable()
export class EnvironmentActivationService implements IEnvironmentActivationService, IDisposable {
    private readonly disposables: IDisposable[] = [];
    constructor(
        @inject(ITerminalHelper) private readonly helper: ITerminalHelper,
        @inject(IPlatformService) private readonly platform: IPlatformService,
        @inject(IProcessServiceFactory) private processServiceFactory: IProcessServiceFactory,
        @inject(ICurrentProcess) private currentProcess: ICurrentProcess,
        @inject(IEnvironmentVariablesProvider) private readonly envVarsService: IEnvironmentVariablesProvider
    ) {}

    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
    @traceDecorators.verbose('getActivatedEnvironmentVariables', LogOptions.Arguments)
    @captureTelemetry(EventName.PYTHON_INTERPRETER_ACTIVATION_ENVIRONMENT_VARIABLES, { failed: false }, true)
    public async getActivatedEnvironmentVariables(resource: Resource, interpreter?: PythonInterpreter, allowExceptions?: boolean): Promise<NodeJS.ProcessEnv | undefined> {
        const shellInfo = defaultShells[this.platform.osType];
        if (!shellInfo) {
            return;
        }
        let isPossiblyCondaEnv = false;
        try {
            const activationCommands = await this.helper.getEnvironmentActivationShellCommands(resource, shellInfo.shellType, interpreter);
            traceVerbose(`Activation Commands received ${activationCommands} for shell ${shellInfo.shell}`);
            if (!activationCommands || !Array.isArray(activationCommands) || activationCommands.length === 0) {
                return;
            }
            isPossiblyCondaEnv = activationCommands
                .join(' ')
                .toLowerCase()
                .includes('conda');
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
            const printEnvPyFile = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'printEnvVariables.py');
            const command = `${activationCommand} && echo '${getEnvironmentPrefix}' && python ${printEnvPyFile.fileToCommandArgument()}`;
            traceVerbose(`Activating Environment to capture Environment variables, ${command}`);

            // Conda activate can hang on certain systems. Fail after 30 seconds.
            // See the discussion from hidesoon in this issue: https://github.com/Microsoft/vscode-python/issues/4424
            // His issue is conda never finishing during activate. This is a conda issue, but we
            // should at least tell the user.
            const result = await processService.shellExec(command, { env, shell: shellInfo.shell, timeout: getEnvironmentTimeout, maxBuffer: 1000 * 1000 });
            if (result.stderr && result.stderr.length > 0) {
                throw new Error(`StdErr from ShellExec, ${result.stderr}`);
            }
            const returnedEnv = this.parseEnvironmentOutput(result.stdout);

            // Put back the PYTHONWARNINGS value
            if (oldWarnings && returnedEnv) {
                returnedEnv[PYTHON_WARNINGS] = oldWarnings;
            } else if (returnedEnv) {
                delete returnedEnv[PYTHON_WARNINGS];
            }
            return returnedEnv;
        } catch (e) {
            traceError('getActivatedEnvironmentVariables', e);
            sendTelemetryEvent(EventName.ACTIVATE_ENV_TO_GET_ENV_VARS_FAILED, undefined, { isPossiblyCondaEnv, terminal: shellInfo.shellType });

            // Some callers want this to bubble out, others don't
            if (allowExceptions) {
                throw e;
            }
        }
    }
    protected fixActivationCommands(commands: string[]): string[] {
        // Replace 'source ' with '. ' as that works in shell exec
        return commands.map(cmd => cmd.replace(/^source\s+/, '. '));
    }
    @traceDecorators.error('Failed to parse Environment variables')
    @traceDecorators.verbose('parseEnvironmentOutput', LogOptions.None)
    protected parseEnvironmentOutput(output: string): NodeJS.ProcessEnv | undefined {
        output = output.substring(output.indexOf(getEnvironmentPrefix) + getEnvironmentPrefix.length);
        const js = output.substring(output.indexOf('{')).trim();
        return JSON.parse(js);
    }
}
