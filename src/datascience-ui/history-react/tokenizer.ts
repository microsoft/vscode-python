// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { wireTmGrammars } from 'monaco-editor-textmate';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import { Registry } from 'monaco-textmate';
import { loadWASM } from 'onigasm';
import { PYTHON_LANGUAGE } from '../../client/common/constants';

// tslint:disable: no-any
export async function initializeTokenizer(
        getOnigasm: () => Promise<ArrayBuffer>,
        getTmlanguageJSON: () => Promise<string>,
        loadingFinished: (e?: any) => void): Promise<void> {
    try {
        // Tell monaco about our language
        monacoEditor.languages.register({
            id: PYTHON_LANGUAGE,
            extensions: ['.py']
        });

        // Load the web assembly
        const blob = await getOnigasm();
        await loadWASM(blob);

        // Setup our registry of different
        const registry = new Registry({
            getGrammarDefinition: async (_scopeName) => {
                return {
                    format: 'json',
                    content: await getTmlanguageJSON()
                };
            }
        });

        // map of monaco "language id's" to TextMate scopeNames
        const grammars = new Map();
        grammars.set('python', 'source.python');

        // Wire everything together.
        await wireTmGrammars(monacoEditor, registry, grammars);

        // Indicate to the callback that we're done.
        loadingFinished();
    } catch (e) {
        loadingFinished(e);
    }
}
