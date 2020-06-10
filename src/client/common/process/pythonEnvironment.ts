// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CondaEnvironmentInfo } from '../../pythonEnvironments/discovery/locators/services/conda';
import { InterpreterInformation } from '../../pythonEnvironments/discovery/types';
import { traceError, traceInfo } from '../logger';
import { IFileSystem } from '../platform/types';
import { Architecture } from '../utils/platform';
import { parsePythonVersion } from '../utils/version';
import * as internalPython from './internal/python';
import * as internalScripts from './internal/scripts';
import { ExecutionResult, IProcessService, PythonExecutionInfo, ShellOptions, SpawnOptions } from './types';

function getExecutionInfo(python: string[], pythonArgs: string[]): PythonExecutionInfo {
    const args = python.slice(1);
    args.push(...pythonArgs);
    return { command: python[0], args, python };
}

class PythonEnvironment {
    private cachedInterpreterInformation: InterpreterInformation | undefined | null = null;

    constructor(
        protected readonly pythonPath: string,
        // "deps" is the externally defined functionality used by the class.
        protected readonly deps: {
            getPythonArgv(python: string): string[];
            getObservablePythonArgv(python: string): string[];
            isValidExecutable(python: string): Promise<boolean>;
            // from ProcessService:
            exec(file: string, args: string[]): Promise<ExecutionResult<string>>;
            shellExec(command: string, timeout: number): Promise<ExecutionResult<string>>;
        }
    ) {}

    public getExecutionInfo(pythonArgs: string[] = []): PythonExecutionInfo {
        const python = this.deps.getPythonArgv(this.pythonPath);
        return getExecutionInfo(python, pythonArgs);
    }
    public getExecutionObservableInfo(pythonArgs: string[] = []): PythonExecutionInfo {
        const python = this.deps.getObservablePythonArgv(this.pythonPath);
        return getExecutionInfo(python, pythonArgs);
    }

    public async getInterpreterInformation(): Promise<InterpreterInformation | undefined> {
        if (this.cachedInterpreterInformation === null) {
            this.cachedInterpreterInformation = await this.getInterpreterInformationImpl();
        }
        return this.cachedInterpreterInformation;
    }

    public async getExecutablePath(): Promise<string> {
        // If we've passed the python file, then return the file.
        // This is because on mac if using the interpreter /usr/bin/python2.7 we can get a different value for the path
        if (await this.deps.isValidExecutable(this.pythonPath)) {
            return this.pythonPath;
        }

        const [args, parse] = internalPython.getExecutable();
        const info = this.getExecutionInfo(args);
        const proc = await this.deps.exec(info.command, info.args);
        return parse(proc.stdout);
    }

    public async isModuleInstalled(moduleName: string): Promise<boolean> {
        // prettier-ignore
        const [args,] = internalPython.isModuleInstalled(moduleName);
        const info = this.getExecutionInfo(args);
        try {
            await this.deps.exec(info.command, info.args);
        } catch {
            return false;
        }
        return true;
    }

    private async getInterpreterInformationImpl(): Promise<InterpreterInformation | undefined> {
        try {
            const execInfo = this.getExecutionInfo();
            const [args, parse] = internalScripts.interpreterInfo();
            const argv = [...execInfo.python, ...args];

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
            const json = parse(result.stdout);
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

function createDeps(
    isValidExecutable: (filename: string) => Promise<boolean>,
    pythonArgv: string[] | undefined,
    observablePythonArgv: string[] | undefined,
    // from ProcessService:
    exec: (file: string, args: string[], options?: SpawnOptions) => Promise<ExecutionResult<string>>,
    shellExec: (command: string, options?: ShellOptions) => Promise<ExecutionResult<string>>
) {
    return {
        getPythonArgv: (python: string) => pythonArgv || [python],
        getObservablePythonArgv: (python: string) => observablePythonArgv || [python],
        isValidExecutable,
        exec: async (cmd: string, args: string[]) => exec(cmd, args, { throwOnStdErr: true }),
        shellExec: async (text: string, timeout: number) => shellExec(text, { timeout })
    };
}

export function createPythonEnv(
    pythonPath: string,
    // These are used to generate the deps.
    procs: IProcessService,
    fs: IFileSystem
): PythonEnvironment {
    const deps = createDeps(
        async (filename) => fs.fileExists(filename),
        // We use the default: [pythonPath].
        undefined,
        undefined,
        (file, args, opts) => procs.exec(file, args, opts),
        (command, opts) => procs.shellExec(command, opts)
    );
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
    const runArgs = ['run'];
    if (condaInfo.name === '') {
        runArgs.push('-p', condaInfo.path);
    } else {
        runArgs.push('-n', condaInfo.name);
    }
    const pythonArgv = [condaFile, ...runArgs, 'python'];
    const deps = createDeps(
        async (filename) => fs.fileExists(filename),
        pythonArgv,
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: Use pythonArgv here once 'conda run' can be
        // run without buffering output.
        // See https://github.com/microsoft/vscode-python/issues/8473.
        undefined,
        (file, args, opts) => procs.exec(file, args, opts),
        (command, opts) => procs.shellExec(command, opts)
    );
    return new PythonEnvironment(pythonPath, deps);
}

export function createWindowsStoreEnv(
    pythonPath: string,
    // These are used to generate the deps.
    procs: IProcessService
): PythonEnvironment {
    const deps = createDeps(
        /**
         * With windows store python apps, we have generally use the
         * symlinked python executable.  The actual file is not accessible
         * by the user due to permission issues (& rest of exension fails
         * when using that executable).  Hence lets not resolve the
         * executable using sys.executable for windows store python
         * interpreters.
         */
        async (_f: string) => true,
        // We use the default: [pythonPath].
        undefined,
        undefined,
        (file, args, opts) => procs.exec(file, args, opts),
        (command, opts) => procs.shellExec(command, opts)
    );
    return new PythonEnvironment(pythonPath, deps);
}
