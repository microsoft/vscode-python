// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { injectable } from 'inversify';
import * as path from 'path';

import { IServiceContainer } from '../../ioc/types';
import { EXTENSION_ROOT_DIR } from '../constants';
import { ErrorUtils } from '../errors/errorUtils';
import { ModuleNotInstalledError } from '../errors/moduleNotInstalledError';
import { traceError, traceInfo } from '../logger';
import { IFileSystem } from '../platform/types';
import { Architecture } from '../utils/platform';
import { parsePythonVersion } from '../utils/version';
import {
    ExecutionResult,
    InterpreterInfomation,
    IProcessService,
    IPythonExecutionService,
    ObservableExecutionResult,
    PythonExecutionInfo,
    PythonVersionInfo,
    SpawnOptions
} from './types';

@injectable()
export class PythonExecutionService implements IPythonExecutionService {
    private readonly fileSystem: IFileSystem;
    private cachedInterpreterInformation: InterpreterInfomation | undefined | null = null;

    constructor(
        serviceContainer: IServiceContainer,
        private readonly procService: IProcessService,
        protected readonly pythonPath: string
    ) {
        this.fileSystem = serviceContainer.get<IFileSystem>(IFileSystem);
    }

    public async getInterpreterInformation(): Promise<InterpreterInfomation | undefined> {
        if (this.cachedInterpreterInformation === null) {
            this.cachedInterpreterInformation = await this.getInterpreterInformationImpl();
        }
        return this.cachedInterpreterInformation;
    }

    public async getExecutablePath(): Promise<string> {
        // If we've passed the python file, then return the file.
        // This is because on mac if using the interpreter /usr/bin/python2.7 we can get a different value for the path
        if (await this.fileSystem.fileExists(this.pythonPath)) {
            return this.pythonPath;
        }

        const { command, args } = this.getExecutionInfo(['-c', 'import sys;print(sys.executable)']);
        return this.procService.exec(command, args, { throwOnStdErr: true }).then(output => output.stdout.trim());
    }
    public async isModuleInstalled(moduleName: string): Promise<boolean> {
        const { command, args } = this.getExecutionInfo(['-c', `import ${moduleName}`]);
        return this.procService
            .exec(command, args, { throwOnStdErr: true })
            .then(() => true)
            .catch(() => false);
    }

    public getExecutionInfo(args: string[]): PythonExecutionInfo {
        return { command: this.pythonPath, args };
    }

    public execObservable(args: string[], options: SpawnOptions): ObservableExecutionResult<string> {
        const opts: SpawnOptions = { ...options };
        // Cannot use this.getExecutionInfo() until 'conda run' can be run without buffering output.
        // See https://github.com/microsoft/vscode-python/issues/8473
        return this.procService.execObservable(this.pythonPath, args, opts);
    }
    public execModuleObservable(
        moduleName: string,
        args: string[],
        options: SpawnOptions
    ): ObservableExecutionResult<string> {
        const opts: SpawnOptions = { ...options };
        // Cannot use this.getExecutionInfo() until 'conda run' can be run without buffering output.
        // See https://github.com/microsoft/vscode-python/issues/8473
        return this.procService.execObservable(this.pythonPath, ['-m', moduleName, ...args], opts);
    }
    public async exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> {
        const opts: SpawnOptions = { ...options };
        const executable = this.getExecutionInfo(args);
        return this.procService.exec(executable.command, executable.args, opts);
    }
    public async execModule(
        moduleName: string,
        args: string[],
        options: SpawnOptions
    ): Promise<ExecutionResult<string>> {
        const opts: SpawnOptions = { ...options };
        const executable = this.getExecutionInfo(['-m', moduleName, ...args]);
        const result = await this.procService.exec(executable.command, executable.args, opts);

        // If a module is not installed we'll have something in stderr.
        if (moduleName && ErrorUtils.outputHasModuleNotInstalledError(moduleName!, result.stderr)) {
            const isInstalled = await this.isModuleInstalled(moduleName!);
            if (!isInstalled) {
                throw new ModuleNotInstalledError(moduleName!);
            }
        }

        return result;
    }

    private async getInterpreterInformationImpl(): Promise<InterpreterInfomation | undefined> {
        const file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'interpreterInfo.py');
        try {
            // Sometimes the python path isn't valid, timeout if that's the case.
            // See these two bugs:
            // https://github.com/microsoft/vscode-python/issues/7569
            // https://github.com/microsoft/vscode-python/issues/7760
            const { command, args } = this.getExecutionInfo([file]);

            // Concat these together to make a set of quoted strings
            const quoted = [command, ...args].reduce(
                (p, c) => (p ? `${p} "${c}"` : `"${c.replace('\\', '\\\\')}"`),
                ''
            );

            // Try shell execing the command, followed by the arguments. This will make node kill the process if it
            // takes too long.
            const result = await this.procService.shellExec(quoted, { timeout: 15000 });
            if (result.stderr) {
                traceError(`Failed to parse interpreter information for ${command} ${args} stderr: ${result.stderr}`);
                return;
            }

            let json: { versionInfo: PythonVersionInfo; sysPrefix: string; sysVersion: string; is64Bit: boolean };
            try {
                json = JSON.parse(result.stdout);
            } catch (ex) {
                traceError(
                    `Failed to parse interpreter information for '${command} ${args}' with JSON ${result.stdout}`,
                    ex
                );
                return;
            }
            traceInfo(`Found interpreter for ${command} ${args}`);
            const versionValue =
                json.versionInfo.length === 4
                    ? `${json.versionInfo.slice(0, 3).join('.')}-${json.versionInfo[3]}`
                    : json.versionInfo.join('.');
            return {
                architecture: json.is64Bit ? Architecture.x64 : Architecture.x86,
                path: this.pythonPath,
                version: parsePythonVersion(versionValue),
                sysVersion: json.sysVersion,
                sysPrefix: json.sysPrefix
            };
        } catch (ex) {
            traceError(`Failed to get interpreter information for '${this.pythonPath}'`, ex);
        }
    }
}
