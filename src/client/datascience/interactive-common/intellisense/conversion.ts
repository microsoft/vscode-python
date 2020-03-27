// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as vscode from 'vscode';
import * as vscodeLanguageClient from 'vscode-languageclient';

// See the comment on convertCompletionItemKind below
// Here's the monaco enum:
enum monacoCompletionItemKind {
    Method = 0,
    Function = 1,
    Constructor = 2,
    Field = 3,
    Variable = 4,
    Class = 5,
    Struct = 6,
    Interface = 7,
    Module = 8,
    Property = 9,
    Event = 10,
    Operator = 11,
    Unit = 12,
    Value = 13,
    Constant = 14,
    Enum = 15,
    EnumMember = 16,
    Keyword = 17,
    Text = 18,
    Color = 19,
    File = 20,
    Reference = 21,
    Customcolor = 22,
    Folder = 23,
    TypeParameter = 24,
    Snippet = 25,
}
//

// Left side is the vscode value.
const mapCompletionItemKind: Map<number, number> = new Map<number, number>([
    [vscode.CompletionItemKind.Text, monacoCompletionItemKind.Text], // Text
    [vscode.CompletionItemKind.Method, monacoCompletionItemKind.Method], // Method
    [vscode.CompletionItemKind.Function, monacoCompletionItemKind.Function], // Function
    [vscode.CompletionItemKind.Constructor, monacoCompletionItemKind.Constructor], // Constructor
    [vscode.CompletionItemKind.Field, monacoCompletionItemKind.Field], // Field
    [vscode.CompletionItemKind.Variable, monacoCompletionItemKind.Variable], // Variable
    [vscode.CompletionItemKind.Class, monacoCompletionItemKind.Class], // Class
    [vscode.CompletionItemKind.Interface, monacoCompletionItemKind.Interface], // Interface
    [vscode.CompletionItemKind.Module, monacoCompletionItemKind.Module], // Module
    [vscode.CompletionItemKind.Property, monacoCompletionItemKind.Property], // Property
    [vscode.CompletionItemKind.Unit, monacoCompletionItemKind.Unit], // Unit
    [vscode.CompletionItemKind.Value, monacoCompletionItemKind.Value], // Value
    [vscode.CompletionItemKind.Enum, monacoCompletionItemKind.Enum], // Enum
    [vscode.CompletionItemKind.Keyword, monacoCompletionItemKind.Keyword], // Keyword
    [vscode.CompletionItemKind.Snippet, monacoCompletionItemKind.Snippet], // Snippet
    [vscode.CompletionItemKind.Color, monacoCompletionItemKind.Color], // Color
    [vscode.CompletionItemKind.File, monacoCompletionItemKind.File], // File
    [vscode.CompletionItemKind.Reference, monacoCompletionItemKind.Reference], // Reference
    [vscode.CompletionItemKind.Folder, monacoCompletionItemKind.Folder], // Folder
    [vscode.CompletionItemKind.EnumMember, monacoCompletionItemKind.EnumMember], // EnumMember
    [vscode.CompletionItemKind.Constant, monacoCompletionItemKind.Constant], // Constant
    [vscode.CompletionItemKind.Struct, monacoCompletionItemKind.Struct], // Struct
    [vscode.CompletionItemKind.Event, monacoCompletionItemKind.Event], // Event
    [vscode.CompletionItemKind.Operator, monacoCompletionItemKind.Operator], // Operator
    [vscode.CompletionItemKind.TypeParameter, monacoCompletionItemKind.TypeParameter], // TypeParameter
]);

// Left side is the monaco value.
const reverseMapCompletionItemKind: Map<number, vscode.CompletionItemKind> = new Map<number, vscode.CompletionItemKind>(
    [
        [monacoCompletionItemKind.Text, vscode.CompletionItemKind.Text], // Text
        [monacoCompletionItemKind.Method, vscode.CompletionItemKind.Method], // Method
        [monacoCompletionItemKind.Function, vscode.CompletionItemKind.Function], // Function
        [monacoCompletionItemKind.Constructor, vscode.CompletionItemKind.Constructor], // Constructor
        [monacoCompletionItemKind.Field, vscode.CompletionItemKind.Field], // Field
        [monacoCompletionItemKind.Variable, vscode.CompletionItemKind.Variable], // Variable
        [monacoCompletionItemKind.Class, vscode.CompletionItemKind.Class], // Class
        [monacoCompletionItemKind.Interface, vscode.CompletionItemKind.Interface], // Interface
        [monacoCompletionItemKind.Module, vscode.CompletionItemKind.Module], // Module
        [monacoCompletionItemKind.Property, vscode.CompletionItemKind.Property], // Property
        [monacoCompletionItemKind.Unit, vscode.CompletionItemKind.Unit], // Unit
        [monacoCompletionItemKind.Value, vscode.CompletionItemKind.Value], // Value
        [monacoCompletionItemKind.Enum, vscode.CompletionItemKind.Enum], // Enum
        [monacoCompletionItemKind.Keyword, vscode.CompletionItemKind.Keyword], // Keyword
        [monacoCompletionItemKind.Snippet, vscode.CompletionItemKind.Snippet], // Snippet
        [monacoCompletionItemKind.Color, vscode.CompletionItemKind.Color], // Color
        [monacoCompletionItemKind.File, vscode.CompletionItemKind.File], // File
        [monacoCompletionItemKind.Reference, vscode.CompletionItemKind.Reference], // Reference
        [monacoCompletionItemKind.Folder, vscode.CompletionItemKind.Folder], // Folder
        [monacoCompletionItemKind.EnumMember, vscode.CompletionItemKind.EnumMember], // EnumMember
        [monacoCompletionItemKind.Constant, vscode.CompletionItemKind.Constant], // Constant
        [monacoCompletionItemKind.Struct, vscode.CompletionItemKind.Struct], // Struct
        [monacoCompletionItemKind.Event, vscode.CompletionItemKind.Event], // Event
        [monacoCompletionItemKind.Operator, vscode.CompletionItemKind.Operator], // Operator
        [monacoCompletionItemKind.TypeParameter, vscode.CompletionItemKind.TypeParameter], // TypeParameter
    ]
);

const mapJupyterKind: Map<string, number> = new Map<string, number>([
    ['method', monacoCompletionItemKind.Method],
    ['function', monacoCompletionItemKind.Function],
    ['constructor', monacoCompletionItemKind.Constructor],
    ['field', monacoCompletionItemKind.Field],
    ['variable', monacoCompletionItemKind.Variable],
    ['class', monacoCompletionItemKind.Class],
    ['struct', monacoCompletionItemKind.Struct],
    ['interface', monacoCompletionItemKind.Interface],
    ['module', monacoCompletionItemKind.Module],
    ['property', monacoCompletionItemKind.Property],
    ['event', monacoCompletionItemKind.Event],
    ['operator', monacoCompletionItemKind.Operator],
    ['unit', monacoCompletionItemKind.Unit],
    ['value', monacoCompletionItemKind.Value],
    ['constant', monacoCompletionItemKind.Constant],
    ['enum', monacoCompletionItemKind.Enum],
    ['enumMember', monacoCompletionItemKind.EnumMember],
    ['keyword', monacoCompletionItemKind.Keyword],
    ['text', monacoCompletionItemKind.Text],
    ['color', monacoCompletionItemKind.Color],
    ['file', monacoCompletionItemKind.File],
    ['reference', monacoCompletionItemKind.Reference],
    ['customcolor', monacoCompletionItemKind.Customcolor],
    ['folder', monacoCompletionItemKind.Folder],
    ['typeParameter', monacoCompletionItemKind.TypeParameter],
    ['snippet', monacoCompletionItemKind.Snippet],
    ['<unknown>', monacoCompletionItemKind.Snippet],
]);

function convertToMonacoRange(range: vscodeLanguageClient.Range | undefined): monacoEditor.IRange | undefined {
    if (range) {
        return {
            startLineNumber: range.start.line + 1,
            startColumn: range.start.character + 1,
            endLineNumber: range.end.line + 1,
            endColumn: range.end.character + 1,
        };
    }
}

function convertToVSCodeRange(range: monacoEditor.IRange | undefined): vscode.Range | undefined {
    if (range) {
        return new vscode.Range(
            new vscode.Position(range.startLineNumber - 1, range.startColumn - 1),
            new vscode.Position(range.endLineNumber - 1, range.endColumn - 1)
        );
    }
}

// Something very fishy. If the monacoEditor.languages.CompletionItemKind is included here, we get this error on startup
// Activating extension `ms-python.python` failed:  Unexpected token {
// extensionHostProcess.js:457
// Here is the error stack:  f:\vscode-python\node_modules\monaco-editor\esm\vs\editor\editor.api.js:5
// import { EDITOR_DEFAULTS } from './common/config/editorOptions.js';
// Instead just use a map
function convertToMonacoCompletionItemKind(kind?: number): number {
    const value = kind ? mapCompletionItemKind.get(kind) : monacoCompletionItemKind.Property; // Property is 9
    if (value) {
        return value;
    }
    return monacoCompletionItemKind.Property;
}

function convertToVSCodeCompletionItemKind(kind?: number): vscode.CompletionItemKind {
    const value = kind ? reverseMapCompletionItemKind.get(kind) : vscode.CompletionItemKind.Property;
    if (value) {
        return value;
    }
    return vscode.CompletionItemKind.Property;
}

const SnippetEscape = 4;

export function convertToMonacoCompletionItem(
    item: vscodeLanguageClient.CompletionItem,
    requiresKindConversion: boolean
): monacoEditor.languages.CompletionItem {
    // They should be pretty much identical? Except for ranges.
    // tslint:disable-next-line: no-object-literal-type-assertion no-any
    const result = ({ ...item } as any) as monacoEditor.languages.CompletionItem;
    if (requiresKindConversion) {
        result.kind = convertToMonacoCompletionItemKind(item.kind);
    }

    // Make sure we have insert text, otherwise the monaco editor will crash on trying to hit tab or enter on the text
    if (!result.insertText && result.label) {
        result.insertText = result.label;
    }

    // tslint:disable-next-line: no-any
    const snippet = (result.insertText as any) as vscode.SnippetString;
    if (snippet.value) {
        result.insertTextRules = SnippetEscape;
        // Monaco can't handle the snippetText value, so rewrite it.
        result.insertText = snippet.value;
    }

    // Make sure we don't have _documentPosition. It holds onto a huge tree of information
    // tslint:disable-next-line: no-any
    const resultAny = result as any;
    if (resultAny._documentPosition) {
        delete resultAny._documentPosition;
    }

    return result;
}

export function convertToVSCodeCompletionItem(item: monacoEditor.languages.CompletionItem): vscode.CompletionItem {
    // tslint:disable-next-line: no-object-literal-type-assertion no-any
    const result = ({ ...item } as any) as vscode.CompletionItem;

    if (item.kind && result.kind) {
        result.kind = convertToVSCodeCompletionItemKind(item.kind);
    }

    if (item.range && result.range) {
        result.range = convertToVSCodeRange(item.range);
    }

    return result;
}

export function convertToMonacoCompletionList(
    result:
        | vscodeLanguageClient.CompletionList
        | vscodeLanguageClient.CompletionItem[]
        | vscode.CompletionItem[]
        | vscode.CompletionList
        | null,
    requiresKindConversion: boolean
): monacoEditor.languages.CompletionList {
    if (result) {
        if (result.hasOwnProperty('items')) {
            const list = result as vscodeLanguageClient.CompletionList;
            return {
                suggestions: list.items.map((l) => convertToMonacoCompletionItem(l, requiresKindConversion)),
                incomplete: list.isIncomplete,
            };
        } else {
            // Must be one of the two array types since there's no items property.
            const array = result as vscodeLanguageClient.CompletionItem[];
            return {
                suggestions: array.map((l) => convertToMonacoCompletionItem(l, requiresKindConversion)),
                incomplete: false,
            };
        }
    }

    return {
        suggestions: [],
        incomplete: false,
    };
}

function convertToMonacoMarkdown(
    strings:
        | vscodeLanguageClient.MarkupContent
        | vscodeLanguageClient.MarkedString
        | vscodeLanguageClient.MarkedString[]
        | vscode.MarkedString
        | vscode.MarkedString[]
): monacoEditor.IMarkdownString[] {
    if (strings.hasOwnProperty('kind')) {
        const content = strings as vscodeLanguageClient.MarkupContent;
        return [
            {
                value: content.value,
            },
        ];
    } else if (strings.hasOwnProperty('value')) {
        // tslint:disable-next-line: no-any
        const content = strings as any;
        return [
            {
                value: content.value,
            },
        ];
    } else if (typeof strings === 'string') {
        return [
            {
                value: strings.toString(),
            },
        ];
    } else if (Array.isArray(strings)) {
        const array = strings as vscodeLanguageClient.MarkedString[];
        return array.map((a) => convertToMonacoMarkdown(a)[0]);
    }

    return [];
}

export function convertToMonacoHover(
    result: vscodeLanguageClient.Hover | vscode.Hover | null | undefined
): monacoEditor.languages.Hover {
    if (result) {
        return {
            contents: convertToMonacoMarkdown(result.contents),
            range: convertToMonacoRange(result.range),
        };
    }

    return {
        contents: [],
    };
}

export function convertStringsToSuggestions(
    strings: ReadonlyArray<string>,
    range: monacoEditor.IRange,
    // tslint:disable-next-line: no-any
    metadata: any
): monacoEditor.languages.CompletionItem[] {
    // Try to compute kind from the metadata.
    let kinds: number[];
    if (metadata && metadata._jupyter_types_experimental) {
        // tslint:disable-next-line: no-any
        kinds = metadata._jupyter_types_experimental.map((e: any) => {
            const result = mapJupyterKind.get(e.type);
            return result ? result : 3; // If not found use Field = 3
        });
    }

    return strings.map((s: string, i: number) => {
        return {
            label: s,
            insertText: s,
            sortText: s,
            kind: kinds ? kinds[i] : 3, // Note: importing the monacoEditor.languages.CompletionItemKind causes a failure in loading the extension. So we use numbers.
            range,
        };
    });
}

export function convertToMonacoSignatureHelp(
    result: vscodeLanguageClient.SignatureHelp | vscode.SignatureHelp | null
): monacoEditor.languages.SignatureHelp {
    if (result) {
        return result as monacoEditor.languages.SignatureHelp;
    }

    return {
        signatures: [],
        activeParameter: 0,
        activeSignature: 0,
    };
}
