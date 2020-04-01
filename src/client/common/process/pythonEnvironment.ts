// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { CondaEnvironmentInfo } from '../../interpreter/contracts';
import { EXTENSION_ROOT_DIR } from '../constants';
import { traceError, traceInfo } from '../logger';
import { IFileSystem } from '../platform/types';
import { Architecture } from '../utils/platform';
import { parsePythonVersion } from '../utils/version';
import {
    ExecutionResult,
    InterpreterInfomation,
    IProcessService,
    PythonExecutionInfo,
    PythonVersionInfo
} from './types';

interface IPythonEnvironmentDependencies {
    fileExists(filename: string): Promise<boolean>;
    exec(file: string, args: string[]): Promise<ExecutionResult<string>>;
    shellExec(command: string, timeout: number): Promise<ExecutionResult<string>>;
}

function createPythonEnvDeps(
    // These are wrapped in various simple ways.
    procs: IProcessService,
    fs: IFileSystem
): IPythonEnvironmentDependencies {
    return {
        fileExists: (filename: string) => fs.fileExists(filename),
        exec: async (cmd: string, args: string[]) => procs.exec(cmd, args, { throwOnStdErr: true }),
        shellExec: async (text: string, timeout: number) => procs.shellExec(text, { timeout })
    };
}

// PythonEnvironment is only exported for the sake of testing.
export class PythonEnvironment {
    private cachedInterpreterInformation: InterpreterInfomation | undefined | null = null;

    constructor(
        // tslint:disable-next-line:no-suspicious-comment
        // TODO(gh-8473): "pythonPath" should be made protected.  It is
        // public only for the sake of the workaround we have in place
        // for conda in pythonProcess.ts.
        public readonly pythonPath: string,
        protected readonly deps: IPythonEnvironmentDependencies
    ) {}

    public getExecutionInfo(pythonArgs?: string[]): PythonExecutionInfo {
        const python = this.getPythonArgv();
        const args = python.slice(1);
        if (pythonArgs) {
            args.push(...pythonArgs);
        }
        return { command: python[0], args, python };
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
        if (await this.deps.fileExists(this.pythonPath)) {
            return this.pythonPath;
        }

        const { command, args } = this.getExecutionInfo(['-c', 'import sys;print(sys.executable)']);
        const proc = await this.deps.exec(command, args);
        return proc.stdout.trim();
    }

    public async isModuleInstalled(moduleName: string): Promise<boolean> {
        const { command, args } = this.getExecutionInfo(['-c', `import ${moduleName}`]);
        try {
            await this.deps.exec(command, args);
        } catch {
            return false;
        }
        return true;
    }

    protected getPythonArgv(): string[] {
        return [this.pythonPath];
    }

    private async getInterpreterInformationImpl(): Promise<InterpreterInfomation | undefined> {
        try {
            const file = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'interpreterInfo.py');
            const { command, args } = this.getExecutionInfo([file]);
            const argv = [command, ...args];

            // Concat these together to make a set of quoted strings
            const quoted = argv.reduce((p, c) => (p ? `${p} "${c}"` : `"${c.replace('\\', '\\\\')}"`), '');

            // Try shell execing the command, followed by the arguments. This will make node kill the process if it
            // takes too long.
            // Sometimes the python path isn't valid, timeout if that's the case.
            // See these two bugs:
            // https://github.com/microsoft/vscode-python/issues/7569
            // https://github.com/microsoft/vscode-python/issues/7760
            const result = await this.deps.shellExec(quoted, 15000);
            if (result.stderr) {
                traceError(`Failed to parse interpreter information for ${argv} stderr: ${result.stderr}`);
                return;
            }
            let json: {
                versionInfo: PythonVersionInfo;
                sysPrefix: string;
                sysVersion: string;
                is64Bit: boolean;
            };
            try {
                json = JSON.parse(result.stdout);
            } catch (ex) {
                throw Error(`${argv} returned bad JSON (${result.stdout}) (${ex})`);
            }
            traceInfo(`Found interpreter for ${argv}`);
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

class CondaEnvironment extends PythonEnvironment {
    private readonly envArgs: string[];
    private readonly runArgs: string[];
    constructor(
        private readonly condaFile: string,
        condaInfo: CondaEnvironmentInfo,
        pythonPath: string,
        deps: IPythonEnvironmentDependencies
    ) {
        super(pythonPath, deps);
        if (condaInfo.name === '') {
            this.envArgs = ['-p', condaInfo.path];
        } else {
            this.envArgs = ['-n', condaInfo.name];
        }
        this.runArgs = ['run', ...this.envArgs];
    }

    protected getPythonArgv(): string[] {
        return [this.condaFile, ...this.runArgs, 'python'];
    }
}

class WindowsStoreEnvironment extends PythonEnvironment {
    /**
     * With windows store python apps, we have generally use the symlinked python executable.
     * The actual file is not accessible by the user due to permission issues (& rest of exension fails when using that executable).
     * Hence lets not resolve the executable using sys.executable for windows store python interpreters.
     *
     * @returns {Promise<string>}
     * @memberof WindowsStorePythonProcess
     */
    public async getExecutablePath(): Promise<string> {
        return this.pythonPath;
    }
}

export function createPythonEnv(
    pythonPath: string,
    // These are used to generate the deps.
    procs: IProcessService,
    fs: IFileSystem
): PythonEnvironment {
    const deps = createPythonEnvDeps(procs, fs);
    return new PythonEnvironment(pythonPath, deps);
}

export function createCondaEnv(
    condaFile: string,
    condaInfo: CondaEnvironmentInfo,
    pythonPath: string,
    // These are used to generate the deps.
    procs: IProcessService,
    fs: IFileSystem
): PythonEnvironment {
    const deps = createPythonEnvDeps(procs, fs);
    return new CondaEnvironment(condaFile, condaInfo, pythonPath, deps);
}

export function createWindowsStoreEnv(
    pythonPath: string,
    // These are used to generate the deps.
    procs: IProcessService,
    fs: IFileSystem
): PythonEnvironment {
    const deps = createPythonEnvDeps(procs, fs);
    return new WindowsStoreEnvironment(pythonPath, deps);
}
