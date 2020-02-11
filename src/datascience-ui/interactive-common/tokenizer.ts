// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { wireTmGrammars } from 'monaco-editor-textmate';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import { Registry } from 'monaco-textmate';
import { loadWASM } from 'onigasm';
import { PYTHON_LANGUAGE } from '../../client/common/constants';

export function registerMonacoLanguage() {
    // Tell monaco about our language
    monacoEditor.languages.register({
        id: PYTHON_LANGUAGE,
        extensions: ['.py']
    });

    // Setup the configuration so that auto indent and other things work. Onigasm is just going to setup the tokenizer
    monacoEditor.languages.setLanguageConfiguration(PYTHON_LANGUAGE, {
        comments: {
            lineComment: '#',
            blockComment: ['"""', '"""']
        },
        brackets: [
            ['{', '}'],
            ['[', ']'],
            ['(', ')']
        ],
        autoClosingPairs: [
            { open: '{', close: '}' },
            { open: '[', close: ']' },
            { open: '(', close: ')' },
            { open: '"', close: '"', notIn: ['string'] },
            { open: "'", close: "'", notIn: ['string', 'comment'] }
        ],
        surroundingPairs: [
            { open: '{', close: '}' },
            { open: '[', close: ']' },
            { open: '(', close: ')' },
            { open: '"', close: '"' },
            { open: "'", close: "'" }
        ],
        onEnterRules: [
            {
                beforeText: new RegExp(
                    '^\\s*(?:def|class|for|if|elif|else|while|try|with|finally|except|async).*?:\\s*$'
                ),
                action: { indentAction: monacoEditor.languages.IndentAction.Indent }
            }
        ],
        folding: {
            offSide: true,
            markers: {
                start: new RegExp('^\\s*#region\\b'),
                end: new RegExp('^\\s*#endregion\\b')
            }
        }
    });
}

// tslint:disable: no-any
export async function initializeTokenizer(
    onigasm: ArrayBuffer,
    tmlanguageJSON: string,
    loadingFinished: (e?: any) => void
): Promise<void> {
    try {
        // Register the language first
        registerMonacoLanguage();

        // Load the web assembly
        await loadWASM(onigasm);

        // Setup our registry of different
        const registry = new Registry({
            getGrammarDefinition: async _scopeName => {
                return {
                    format: 'json',
                    content: tmlanguageJSON
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
