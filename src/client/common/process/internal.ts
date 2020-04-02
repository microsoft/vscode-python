// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../constants';
import { PythonVersionInfo } from './types';

// It is simpler to hard-code it instead of using vscode.ExtensionContext.extensionPath.
const SCRIPTS_DIR = path.join(EXTENSION_ROOT_DIR, 'pythonFiles');

export namespace scripts {
    // ignored:
    // * install_debugoy.py
    // * ptvsd_launcher.py

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
        const args = [script];

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
        const args = [script];
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

    //============================
    // refactor.py

    export function refactor(root: string): [string[], (out: string) => object[]] {
        const script = path.join(SCRIPTS_DIR, 'refactor.py');
        const args = [script, root];

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
        const args = [script, code];

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
        text?: string
    ): [string[], (out: string) => _symbolProvider.Symbols] {
        const script = path.join(SCRIPTS_DIR, 'symbolProvider.py');
        const args = [script, filename];
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
        const args = [script];

        function parse(out: string): NodeJS.ProcessEnv {
            return JSON.parse(out);
        }

        return [args, parse];
    }

    //============================
    // printEnvVariablesToFile.py

    export function printEnvVariablesToFile(filename: string): [string[], (out: string) => NodeJS.ProcessEnv] {
        const script = path.join(SCRIPTS_DIR, 'printEnvVariablesToFile.py');
        const args = [script, filename.fileToCommandArgument()];

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
        return [script, ...testArgs];
    }

    //============================
    // visualstudio_py_testlauncher.py

    export function visualstudio_py_testlauncher(testArgs: string[]): string[] {
        const script = path.join(SCRIPTS_DIR, 'visualstudio_py_testlauncher.py');
        // There is no output to parse, so we do not return a function.
        return [script, ...testArgs];
    }

    //============================
    // testing_tools/

    export namespace testing_tools {
        const _SCRIPTS_DIR = path.join(SCRIPTS_DIR, 'testing_tools');

        type TestNode = {
            id: string;
            name: string;
            parentid: string;
        };
        type TestParent = TestNode & {
            kind: 'folder' | 'file' | 'suite' | 'function';
        };
        type TestFSNode = TestParent & {
            kind: 'folder' | 'file';
            relpath: string;
        };

        export type TestFolder = TestFSNode & {
            kind: 'folder';
        };
        export type TestFile = TestFSNode & {
            kind: 'file';
        };
        export type TestSuite = TestParent & {
            kind: 'suite';
        };
        // function-as-a-container is for parameterized ("sub") tests.
        export type TestFunction = TestParent & {
            kind: 'function';
        };
        export type Test = TestNode & {
            source: string;
        };
        export type DiscoveredTests = {
            rootid: string;
            root: string;
            parents: TestParent[];
            tests: Test[];
        };

        //============================
        // run_adapter.py

        export function run_adapter(adapterArgs: string[]): [string[], (out: string) => DiscoveredTests[]] {
            const script = path.join(_SCRIPTS_DIR, 'run_adapter.py');
            const args = [script, ...adapterArgs];

            function parse(out: string): DiscoveredTests[] {
                return JSON.parse(out);
            }

            return [args, parse];
        }
    }

    //============================
    // vscode_datascience_helpers/

    export namespace vscode_datascience_helpers {
        const _SCRIPTS_DIR = path.join(SCRIPTS_DIR, 'vscode_datascience_helpers');

        type JupyterServerInfo = {
            base_url: string;
            notebook_dir: string;
            hostname: string;
            password: boolean;
            pid: number;
            port: number;
            secure: boolean;
            token: string;
            url: string;
        };

        //============================
        // getJupyterVariableDataFrameInfo.py

        export function getJupyterVariableDataFrameInfo(): string[] {
            const script = path.join(_SCRIPTS_DIR, 'getJupyterVariableDataFrameInfo.py');
            // There is no script-specific output to parse, so we do not return a function.
            return [script];
        }

        //============================
        // getJupyterVariableDataFrameRows.py

        export function getJupyterVariableDataFrameRows(): string[] {
            const script = path.join(_SCRIPTS_DIR, 'getJupyterVariableDataFrameRows.py');
            // There is no script-specific output to parse, so we do not return a function.
            return [script];
        }

        //============================
        // getServerInfo.py

        export function getServerInfo(): [string[], (out: string) => JupyterServerInfo[]] {
            const script = path.join(_SCRIPTS_DIR, 'getServerInfo.py');
            const args = [script];

            function parse(out: string): JupyterServerInfo[] {
                return JSON.parse(out.trim());
            }

            return [args, parse];
        }

        //============================
        // getJupyterKernels.py

        export function getJupyterKernels(): string[] {
            const script = path.join(_SCRIPTS_DIR, 'getJupyterKernels.py');
            // There is no script-specific output to parse, so we do not return a function.
            return [script];
        }

        //============================
        // getJupyterKernelspecVersion.py

        export function getJupyterKernelspecVersion(): string[] {
            const script = path.join(_SCRIPTS_DIR, 'getJupyterKernelspecVersion.py');
            // For now we do not worry about parsing the output here.
            return [script];
        }

        //============================
        // jupyter_nbInstalled.py

        export function jupyter_nbInstalled(): [string[], (out: string) => boolean] {
            const script = path.join(_SCRIPTS_DIR, 'jupyter_nbInstalled.py');
            const args = [script];

            function parse(out: string): boolean {
                return out.toLowerCase().includes('available');
            }

            return [args, parse];
        }
    }
}
