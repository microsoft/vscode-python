// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

export class CompletionProvider implements monacoEditor.languages.CompletionItemProvider {
    triggerCharacters?: string[] | undefined;
    provideCompletionItems(model: monacoEditor.editor.ITextModel, position: monacoEditor.Position, context: monacoEditor.languages.CompletionContext, token: monacoEditor.CancellationToken): monacoEditor.languages.ProviderResult<monacoEditor.languages.CompletionList> {
        throw new Error('Method not implemented.');
    }
    constructor() {
        // Register a completion provider
        monacoEditor.languages.registerCompletionItemProvider('python', this)
    }
}