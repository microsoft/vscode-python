// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { PythonVersionInfo } from '../../../../pythonEnvironments/discovery/types';
import { EXTENSION_ROOT_DIR } from '../../../constants';

// It is simpler to hard-code it instead of using vscode.ExtensionContext.extensionPath.
export const _SCRIPTS_DIR = path.join(EXTENSION_ROOT_DIR, 'pythonFiles');
const SCRIPTS_DIR = _SCRIPTS_DIR;
export const _ISOLATED = path.join(_SCRIPTS_DIR, 'pyvsc-run-isolated.py');
const ISOLATED = _ISOLATED;

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
//  * ptvsd_launcher.py  (used only for the old debug adapter)

export * as testing_tools from './testing_tools';
export * as vscode_datascience_helpers from './vscode_datascience_helpers';

//============================
// interpreterInfo.py

type PythonEnvInfo = {
    versionInfo: PythonVersionInfo;
    sysPrefix: string;
    sysVersion: string;
    is64Bit: boolean;
};

export function interpreterInfo(): [string[], (out: string) => PythonEnvInfo] {
    const script = path.join(SCRIPTS_DIR, 'interpreterInfo.py');
    const args = [ISOLATED, script];

    function parse(out: string): PythonEnvInfo {
        let json: PythonEnvInfo;
        try {
            json = JSON.parse(out);
        } catch (ex) {
            throw Error(`python ${args} returned bad JSON (${out}) (${ex})`);
        }
        return json;
    }

    return [args, parse];
}

//============================
// completion.py

namespace _completion {
    export type Response = (_Response1 | _Response2) & {
        id: number;
    };
    type _Response1 = {
        // tslint:disable-next-line:no-any no-banned-terms
        arguments: any[];
    };
    type _Response2 =
        | CompletionResponse
        | HoverResponse
        | DefinitionResponse
        | ReferenceResponse
        | SymbolResponse
        | ArgumentsResponse;

    type CompletionResponse = {
        results: AutoCompleteItem[];
    };
    type HoverResponse = {
        results: HoverItem[];
    };
    type DefinitionResponse = {
        results: Definition[];
    };
    type ReferenceResponse = {
        results: Reference[];
    };
    type SymbolResponse = {
        results: Definition[];
    };
    type ArgumentsResponse = {
        results: Signature[];
    };

    type Signature = {
        name: string;
        docstring: string;
        description: string;
        paramindex: number;
        params: Argument[];
    };
    type Argument = {
        name: string;
        value: string;
        docstring: string;
        description: string;
    };

    type Reference = {
        name: string;
        fileName: string;
        columnIndex: number;
        lineIndex: number;
        moduleName: string;
    };

    type AutoCompleteItem = {
        type: string;
        kind: string;
        text: string;
        description: string;
        raw_docstring: string;
        rightLabel: string;
    };

    type DefinitionRange = {
        startLine: number;
        startColumn: number;
        endLine: number;
        endColumn: number;
    };
    type Definition = {
        type: string;
        kind: string;
        text: string;
        fileName: string;
        container: string;
        range: DefinitionRange;
    };

    type HoverItem = {
        kind: string;
        text: string;
        description: string;
        docstring: string;
        signature: string;
    };
}

export function completion(jediPath?: string): [string[], (out: string) => _completion.Response[]] {
    const script = path.join(SCRIPTS_DIR, 'completion.py');
    const args = [ISOLATED, script];
    if (jediPath) {
        args.push('custom');
        args.push(jediPath);
    }

    function parse(out: string): _completion.Response[] {
        return out.splitLines().map((resp) => JSON.parse(resp));
    }

    return [args, parse];
}

//============================
// sortImports.py

export function sortImports(filename: string, sortArgs?: string[]): [string[], (out: string) => string] {
    const script = path.join(SCRIPTS_DIR, 'sortImports.py');
    const args = [ISOLATED, script, filename, '--diff'];
    if (sortArgs) {
        args.push(...sortArgs);
    }

    function parse(out: string) {
        // It should just be a diff that the extension will use directly.
        return out;
    }

    return [args, parse];
}

//============================
// refactor.py

export function refactor(root: string): [string[], (out: string) => object[]] {
    const script = path.join(SCRIPTS_DIR, 'refactor.py');
    const args = [ISOLATED, script, root];

    // tslint:disable-next-line:no-suspicious-comment
    // TODO: Make the return type more specific, like we did
    // with completion().
    function parse(out: string): object[] {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: Also handle "STARTED"?
        return out
            .split(/\r?\n/g)
            .filter((line) => line.length > 0)
            .map((resp) => JSON.parse(resp));
    }

    return [args, parse];
}

//============================
// normalizeForInterpreter.py

export function normalizeForInterpreter(code: string): [string[], (out: string) => string] {
    const script = path.join(SCRIPTS_DIR, 'normalizeForInterpreter.py');
    const args = [ISOLATED, script, code];

    function parse(out: string) {
        // The text will be used as-is.
        return out;
    }

    return [args, parse];
}

//============================
// symbolProvider.py

namespace _symbolProvider {
    type Position = {
        line: number;
        character: number;
    };
    type RawSymbol = {
        // If no namespace then ''.
        namespace: string;
        name: string;
        range: {
            start: Position;
            end: Position;
        };
    };
    export type Symbols = {
        classes: RawSymbol[];
        methods: RawSymbol[];
        functions: RawSymbol[];
    };
}

export function symbolProvider(
    filename: string,
    // If "text" is provided then it gets passed to the script as-is.
    text?: string
): [string[], (out: string) => _symbolProvider.Symbols] {
    const script = path.join(SCRIPTS_DIR, 'symbolProvider.py');
    const args = [ISOLATED, script, filename];
    if (text) {
        args.push(text);
    }

    function parse(out: string): _symbolProvider.Symbols {
        return JSON.parse(out);
    }

    return [args, parse];
}

//============================
// printEnvVariables.py

export function printEnvVariables(): [string[], (out: string) => NodeJS.ProcessEnv] {
    const script = path.join(SCRIPTS_DIR, 'printEnvVariables.py').fileToCommandArgument();
    const args = [ISOLATED, script];

    function parse(out: string): NodeJS.ProcessEnv {
        return JSON.parse(out);
    }

    return [args, parse];
}

//============================
// printEnvVariablesToFile.py

export function printEnvVariablesToFile(filename: string): [string[], (out: string) => NodeJS.ProcessEnv] {
    const script = path.join(SCRIPTS_DIR, 'printEnvVariablesToFile.py');
    const args = [ISOLATED, script, filename.fileToCommandArgument()];

    function parse(out: string): NodeJS.ProcessEnv {
        return JSON.parse(out);
    }

    return [args, parse];
}

//============================
// shell_exec.py

export function shell_exec(command: string, lockfile: string, shellArgs: string[]): string[] {
    const script = path.join(SCRIPTS_DIR, 'shell_exec.py');
    // We don't bother with a "parse" function since the output
    // could be anything.
    return [
        ISOLATED,
        script,
        command.fileToCommandArgument(),
        // The shell args must come after the command
        // but before the lockfile.
        ...shellArgs,
        lockfile.fileToCommandArgument()
    ];
}

//============================
// testlauncher.py

export function testlauncher(testArgs: string[]): string[] {
    const script = path.join(SCRIPTS_DIR, 'testlauncher.py');
    // There is no output to parse, so we do not return a function.
    return [ISOLATED, script, ...testArgs];
}

//============================
// visualstudio_py_testlauncher.py

export function visualstudio_py_testlauncher(testArgs: string[]): string[] {
    const script = path.join(SCRIPTS_DIR, 'visualstudio_py_testlauncher.py');
    // There is no output to parse, so we do not return a function.
    return [script, ...testArgs];
}
