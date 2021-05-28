// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { _SCRIPTS_DIR } from './constants';
import { CompletionResponse, SymbolProviderSymbols } from './types';

const SCRIPTS_DIR = _SCRIPTS_DIR;

// "scripts" contains everything relevant to the scripts found under
// the top-level "pythonFiles" directory.  Each of those scripts has
// a function in this module which matches the script's filename.
// Each function provides the commandline arguments that should be
// used when invoking a Python executable, whether through spawn/exec
// or a terminal.
//
// Where relevant (nearly always), the function also returns a "parse"
// function that may be used to deserialize the stdout of the script
// into the corresponding object or objects.  "parse()" takes a single
// string as the stdout text and returns the relevant data.
//
// Some of the scripts are located in subdirectories of "pythonFiles".
// For each of those subdirectories there is a sub-module where
// those scripts' functions may be found.
//
// In some cases one or more types related to a script are exported
// from the same module in which the script's function is located.
// These types typically relate to the return type of "parse()".
//
// ignored scripts:
//  * install_debugpy.py  (used only for extension development)
export * as testingTools from './testing_tools';

// interpreterInfo.py

type ReleaseLevel = 'alpha' | 'beta' | 'candidate' | 'final';
type PythonVersionInfo = [number, number, number, ReleaseLevel, number];
export type InterpreterInfoJson = {
    versionInfo: PythonVersionInfo;
    sysPrefix: string;
    sysVersion: string;
    is64Bit: boolean;
};

export function interpreterInfo(): [string[], (out: string) => InterpreterInfoJson] {
    const script = path.join(SCRIPTS_DIR, 'interpreterInfo.py');
    const args = [script];

    function parse(out: string): InterpreterInfoJson {
        let json: InterpreterInfoJson;
        try {
            json = JSON.parse(out);
        } catch (ex) {
            throw Error(`python ${args} returned bad JSON (${out}) (${ex})`);
        }
        return json;
    }

    return [args, parse];
}

// completion.py

export function completion(jediPath?: string): [string[], (out: string) => CompletionResponse[]] {
    const script = path.join(SCRIPTS_DIR, 'completion.py');
    const args = [script];
    if (jediPath) {
        args.push('custom');
        args.push(jediPath);
    }

    function parse(out: string): CompletionResponse[] {
        return out.splitLines().map((resp) => JSON.parse(resp));
    }

    return [args, parse];
}

// sortImports.py

export function sortImports(filename: string, sortArgs?: string[]): [string[], (out: string) => string] {
    const script = path.join(SCRIPTS_DIR, 'sortImports.py');
    const args = [script, filename, '--diff'];
    if (sortArgs) {
        args.push(...sortArgs);
    }

    function parse(out: string) {
        // It should just be a diff that the extension will use directly.
        return out;
    }

    return [args, parse];
}

// refactor.py

export function refactor(root: string): [string[], (out: string) => Record<string, unknown>[]] {
    const script = path.join(SCRIPTS_DIR, 'refactor.py');
    const args = [script, root];

    // TODO: Make the return type more specific, like we did
    // with completion().
    function parse(out: string): Record<string, unknown>[] {
        // TODO: Also handle "STARTED"?
        return out
            .split(/\r?\n/g)
            .filter((line) => line.length > 0)
            .map((resp) => JSON.parse(resp));
    }

    return [args, parse];
}

// normalizeSelection.py

export function normalizeSelection(): [string[], (out: string) => string] {
    const script = path.join(SCRIPTS_DIR, 'normalizeSelection.py');
    const args = [script];

    function parse(out: string) {
        // The text will be used as-is.
        return out;
    }

    return [args, parse];
}

// symbolProvider.py

export function symbolProvider(
    filename: string,
    // If "text" is provided then it gets passed to the script as-is.
    text?: string,
): [string[], (out: string) => SymbolProviderSymbols] {
    const script = path.join(SCRIPTS_DIR, 'symbolProvider.py');
    const args = [script, filename];
    if (text) {
        args.push(text);
    }

    function parse(out: string): SymbolProviderSymbols {
        return JSON.parse(out);
    }

    return [args, parse];
}

// printEnvVariables.py

export function printEnvVariables(): [string[], (out: string) => NodeJS.ProcessEnv] {
    const script = path.join(SCRIPTS_DIR, 'printEnvVariables.py').fileToCommandArgument();
    const args = [script];

    function parse(out: string): NodeJS.ProcessEnv {
        return JSON.parse(out);
    }

    return [args, parse];
}

// shell_exec.py

// eslint-disable-next-line camelcase
export function shell_exec(command: string, lockfile: string, shellArgs: string[]): string[] {
    const script = path.join(SCRIPTS_DIR, 'shell_exec.py');
    // We don't bother with a "parse" function since the output
    // could be anything.
    return [
        script,
        command.fileToCommandArgument(),
        // The shell args must come after the command
        // but before the lockfile.
        ...shellArgs,
        lockfile.fileToCommandArgument(),
    ];
}

// testlauncher.py

export function testlauncher(testArgs: string[]): string[] {
    const script = path.join(SCRIPTS_DIR, 'testlauncher.py');
    // There is no output to parse, so we do not return a function.
    return [script, ...testArgs];
}

// visualstudio_py_testlauncher.py

// eslint-disable-next-line camelcase
export function visualstudio_py_testlauncher(testArgs: string[]): string[] {
    const script = path.join(SCRIPTS_DIR, 'visualstudio_py_testlauncher.py');
    // There is no output to parse, so we do not return a function.
    return [script, ...testArgs];
}

// tensorboard_launcher.py

export function tensorboardLauncher(args: string[]): string[] {
    const script = path.join(SCRIPTS_DIR, 'tensorboard_launcher.py');
    return [script, ...args];
}
