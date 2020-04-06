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

class PythonEnvironment {
    private cachedInterpreterInformation: InterpreterInfomation | undefined | null = null;

    constructor(
        protected readonly pythonPath: string,
        // This is the externally defined functionality used by the class.
        protected readonly deps: {
            getPythonArgv(python: string): string[];
            // from FileSystem:
            fileExists(filename: string): Promise<boolean>;
            // from ProcessService:
            exec(file: string, args: string[]): Promise<ExecutionResult<string>>;
            shellExec(command: string, timeout: number): Promise<ExecutionResult<string>>;
        }
    ) {}

    public getExecutionInfo(pythonArgs: string[] = []): PythonExecutionInfo {
        const python = this.deps.getPythonArgv(this.pythonPath);
        const args = python.slice(1);
        args.push(...pythonArgs);
        return { command: python[0], args, python };
    }
    public getExecutionObservableInfo(pythonArgs?: string[]): PythonExecutionInfo {
        return this.getExecutionInfo(pythonArgs);
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
    public getExecutionObservableInfo(pythonArgs: string[] = []): PythonExecutionInfo {
        // Cannot use this.env.getExecutionInfo() until 'conda run' can
        // be run without buffering output.
        // See https://github.com/microsoft/vscode-python/issues/8473
        return { command: this.pythonPath, args: pythonArgs, python: [this.pythonPath] };
    }
}

class WindowsStoreEnvironment extends PythonEnvironment {
    /**
     * With windows store python apps, we have generally use the
     * symlinked python executable.  The actual file is not accessible
     * by the user due to permission issues (& rest of exension fails
     * when using that executable).  Hence lets not resolve the
     * executable using sys.executable for windows store python
     * interpreters.
     */
    public async getExecutablePath(): Promise<string> {
        return this.pythonPath;
    }
}

function createDeps(
    // These are very lightly wrapped.
    procs: IProcessService,
    fs: IFileSystem,
    pythonArgv?: string[]
) {
    return {
        getPythonArgv: (python: string) => pythonArgv || [python],
        fileExists: (filename: string) => fs.fileExists(filename),
        exec: async (cmd: string, args: string[]) => procs.exec(cmd, args, { throwOnStdErr: true }),
        shellExec: async (text: string, timeout: number) => procs.shellExec(text, { timeout })
    };
}

export function createPythonEnv(
    pythonPath: string,
    // These are used to generate the deps.
    procs: IProcessService,
    fs: IFileSystem
): PythonEnvironment {
    const deps = createDeps(procs, fs, undefined);
    return new PythonEnvironment(pythonPath, deps);
}

export function createCondaEnv(
    condaFile: string,
    condaInfo: CondaEnvironmentInfo,
    pythonPath: string,
    // These are used to generate the deps.
    procs: IProcessService,
    fs: IFileSystem
): CondaEnvironment {
    const runArgs = ['run'];
    if (condaInfo.name === '') {
        runArgs.push('-p', condaInfo.path);
    } else {
        runArgs.push('-n', condaInfo.name);
    }
    const deps = createDeps(procs, fs, [condaFile, ...runArgs, 'python']);
    return new CondaEnvironment(pythonPath, deps);
}

export function createWindowsStoreEnv(
    pythonPath: string,
    // These are used to generate the deps.
    procs: IProcessService,
    fs: IFileSystem
): WindowsStoreEnvironment {
    const deps = createDeps(procs, fs, undefined);
    return new WindowsStoreEnvironment(pythonPath, deps);
}

export namespace _forTestingUseOnly {
    export function stubBaseGetExecutablePath() {
        // tslint:disable-next-line:no-require-imports
        const sinon = require('sinon');
        return sinon.stub(PythonEnvironment.prototype, 'getExecutablePath');
    }
}
