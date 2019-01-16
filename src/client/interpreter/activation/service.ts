// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';
import * as path from 'path';

import { LogOptions, traceDecorators, traceVerbose } from '../../common/logger';
import { IPlatformService } from '../../common/platform/types';
import { IProcessServiceFactory } from '../../common/process/types';
import { ITerminalHelper } from '../../common/terminal/types';
import { ICurrentProcess, IDisposable, Resource } from '../../common/types';
import {
    cacheResourceSpecificInterpreterData,
    clearCachedResourceSpecificIngterpreterData,
    swallowExceptions
} from '../../common/utils/decorators';
import { OSType } from '../../common/utils/platform';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { captureTelemetry } from '../../telemetry';
import { PYTHON_INTERPRETER_ACTIVATION_ENVIRONMENT_VARIABLES } from '../../telemetry/constants';
import { PythonInterpreter } from '../contracts';
import { IEnvironmentActivationService } from './types';

const getEnvironmentPrefix = 'e8b39361-0157-4923-80e1-22d70d46dee6';
const cacheDuration = 10 * 60 * 1000;

// The shell under which we'll execute activation scripts.
const defaultShells = {
    [OSType.Windows]: 'cmd',
    [OSType.OSX]: 'bash',
    [OSType.Linux]: 'bash',
    [OSType.Unknown]: undefined
};

@injectable()
export class EnvironmentActivationService implements IEnvironmentActivationService, IDisposable {
    private readonly disposables: IDisposable[] = [];
    constructor(@inject(ITerminalHelper) private readonly helper: ITerminalHelper,
        @inject(IPlatformService) private readonly platform: IPlatformService,
        @inject(IProcessServiceFactory) private processServiceFactory: IProcessServiceFactory,
        @inject(ICurrentProcess) private currentProcess: ICurrentProcess,
        @inject(IEnvironmentVariablesProvider) private readonly envVarsService: IEnvironmentVariablesProvider) {

        this.envVarsService.onDidEnvironmentVariablesChange(this.onDidEnvironmentVariablesChange, this, this.disposables);
    }

    public dispose(): void | undefined {
        this.disposables.forEach(d => d.dispose());
    }
    @traceDecorators.verbose('getActivatedEnvironmentVariables', LogOptions.Arguments)
    @swallowExceptions('getActivatedEnvironmentVariables')
    @captureTelemetry(PYTHON_INTERPRETER_ACTIVATION_ENVIRONMENT_VARIABLES, { failed: false }, true)
    @cacheResourceSpecificInterpreterData('ActivatedEnvironmentVariables', cacheDuration)
    public async getActivatedEnvironmentVariables(resource: Resource, interpreter?: PythonInterpreter): Promise<NodeJS.ProcessEnv | undefined> {
        const shell = defaultShells[this.platform.osType];
        if (!shell) {
            return;
        }

        const activationCommands = await this.helper.getEnvironmentActivationShellCommands(resource, interpreter);
        traceVerbose(`Activation Commands received ${activationCommands}`);
        if (!activationCommands || !Array.isArray(activationCommands) || activationCommands.length === 0) {
            return;
        }

        // Run the activate command collect the environment from it.
        const activationCommand = this.fixActivationCommands(activationCommands).join(' && ');
        const processService = await this.processServiceFactory.create(resource);
        const customEnvVars = await this.envVarsService.getEnvironmentVariables(resource);
        const hasCustomEnvVars = Object.keys(customEnvVars).length;
        const env = hasCustomEnvVars ? customEnvVars : this.currentProcess.env;
        traceVerbose(`${hasCustomEnvVars ? 'Has' : 'No'} Custom Env Vars`);

        // In order to make sure we know where the environment output is,
        // put in a dummy echo we can look for
        const printEnvPyFile = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'printEnvVariables.py');
        const command = `${activationCommand} && echo '${getEnvironmentPrefix}' && python ${printEnvPyFile.fileToCommandArgument()}`;
        traceVerbose(`Activating Environment to capture Environment variables, ${command}`);
        const result = await processService.shellExec(command, { env, shell });
        if (result.stderr && result.stderr.length > 0) {
            throw new Error(`StdErr from ShellExec, ${result.stderr}`);
        }
        return this.parseEnvironmentOutput(result.stdout);
    }
    protected onDidEnvironmentVariablesChange(affectedResource: Resource) {
        clearCachedResourceSpecificIngterpreterData('ActivatedEnvironmentVariables', affectedResource);
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
