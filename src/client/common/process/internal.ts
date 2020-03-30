// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../constants';
import { PythonVersionInfo } from './types';

// It is simpler to hard-code it instead of using vscode.ExtensionContext.extensionPath.
const SCRIPTS_DIR = path.join(EXTENSION_ROOT_DIR, 'pythonFiles');

export namespace scripts {
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
            return out.splitLines().map(resp => JSON.parse(resp));
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
                .filter(line => line.length > 0)
                .map(resp => JSON.parse(resp));
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
}
