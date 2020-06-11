// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { wireTmGrammars } from 'monaco-editor-textmate';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import { Registry } from 'monaco-textmate';
import { loadWASM } from 'onigasm';

// Map of grammars to tmlanguage contents
const grammarMap = new Map<string, string>();

// Map of language ids to scope names
const languageMap = new Map<string, string>();

async function getGrammarDefinition(scopeName: string) {
    const mappedGrammar = grammarMap.get(scopeName);
    if (mappedGrammar) {
        return {
            format: 'json',
            content: mappedGrammar
        };
    }
    return {
        format: 'json',
        content: '{}'
        // tslint:disable-next-line: no-any
    } as any;
}

// Loading the onigasm bundles is process wide, so don't bother doing it more than once. Creates memory leaks
// when running tests.
let onigasmData: ArrayBuffer | undefined;
let loadedOnigasm = false;

// Global registry for grammars
const registry = new Registry({ getGrammarDefinition: getGrammarDefinition });

export namespace Tokenizer {
    // Export for loading language data.
    export async function loadLanguage(
        languageId: string,
        extensions: string[],
        scopeName: string,
        config: monacoEditor.languages.LanguageConfiguration,
        languageJSON: string
    ) {
        // See if this language was already registered or not.
        if (!grammarMap.has(scopeName)) {
            grammarMap.set(scopeName, languageJSON);
            monacoEditor.languages.register({ id: languageId, extensions });
            monacoEditor.languages.setLanguageConfiguration(languageId, config);

            // Load the web assembly if necessary
            if (onigasmData && onigasmData.byteLength !== 0 && !loadedOnigasm) {
                loadedOnigasm = true;
                await loadWASM(onigasmData);
            }

            // add scope map
            languageMap.set(languageId, scopeName);

            // Wire everything together.
            await wireTmGrammars(monacoEditor, registry, languageMap);
        }
    }

    // Export for saving onigasm data
    export function loadOnigasm(onigasm: ArrayBuffer) {
        if (!onigasmData) {
            onigasmData = onigasm;
        }
    }

    export function hasOnigasm(): boolean {
        return loadedOnigasm;
    }

    export function hasLanguage(languageId: string): boolean {
        return languageMap.has(languageId);
    }
}
