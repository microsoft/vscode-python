// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as vscode from 'vscode';
import * as vscodeLanguageClient from 'vscode-languageclient';

// See the comment on convertCompletionItemKind below
// Here's the monaco enum:
// Method = 0,
// Function = 1,
// Constructor = 2,
// Field = 3,
// Variable = 4,
// Class = 5,
// Struct = 6,
// Interface = 7,
// Module = 8,
// Property = 9,
// Event = 10,
// Operator = 11,
// Unit = 12,
// Value = 13,
// Constant = 14,
// Enum = 15,
// EnumMember = 16,
// Keyword = 17,
// Text = 18,
// Color = 19,
// File = 20,
// Reference = 21,
// Customcolor = 22,
// Folder = 23,
// TypeParameter = 24,
// Snippet = 25
//
// Here's the vscode enum
// const Text: 1;
// const Method: 2;
// const Function: 3;
// const Constructor: 4;
// const Field: 5;
// const Variable: 6;
// const Class: 7;
// const Interface: 8;
// const Module: 9;
// const Property: 10;
// const Unit: 11;
// const Value: 12;
// const Enum: 13;
// const Keyword: 14;
// const Snippet: 15;
// const Color: 16;
// const File: 17;
// const Reference: 18;
// const Folder: 19;
// const EnumMember: 20;
// const Constant: 21;
// const Struct: 22;
// const Event: 23;
// const Operator: 24;
// const TypeParameter: 25;

// Left side is the vscode value.
const mapCompletionItemKind: Map<number, number> = new Map<number, number>([
    [0, 9],  // No value for zero in vscode
    [1, 18], // Text
    [2, 0],  // Method
    [3, 1],  // Function
    [4, 2],  // Constructor
    [5, 3],  // Field
    [6, 4],  // Variable
    [7, 5],  // Class
    [8, 7],  // Interface
    [9, 8],  // Module
    [10, 9], // Property
    [11, 12], // Unit
    [12, 13], // Value
    [13, 15], // Enum
    [14, 17], // Keyword
    [15, 25], // Snippet
    [16, 19], // Color
    [17, 20], // File
    [18, 21], // Reference
    [19, 23], // Folder
    [20, 16], // EnumMember
    [21, 14], // Constant
    [22, 6], // Struct
    [23, 10], // Event
    [24, 11], // Operator
    [25, 24]  // TypeParameter
]);

const mapJupyterKind: Map<string, number> = new Map<string, number>([
    ['method', 0],
    ['function', 1],
    ['constructor', 2],
    ['field', 3],
    ['variable', 4],
    ['class', 5],
    ['struct', 6],
    ['interface', 7],
    ['module', 8],
    ['property', 9],
    ['event', 10],
    ['operator', 11],
    ['unit', 12],
    ['value', 13],
    ['constant', 14],
    ['enum', 15],
    ['enumMember', 16],
    ['keyword', 17],
    ['text', 18],
    ['color', 19],
    ['file', 20],
    ['reference', 21],
    ['customcolor', 22],
    ['folder', 23],
    ['typeParameter', 24],
    ['snippet', 25],
    ['<unknown>', 25]
]);

function convertToMonacoRange(range: vscodeLanguageClient.Range | undefined): monacoEditor.IRange | undefined {
    if (range) {
        return {
            startLineNumber: range.start.line + 1,
            startColumn: range.start.character + 1,
            endLineNumber: range.end.line + 1,
            endColumn: range.end.character + 1
        };
    }
}

// Something very fishy. If the monacoEditor.languages.CompletionItemKind is included here, we get this error on startup
// Activating extension `ms-python.python` failed:  Unexpected token {
// extensionHostProcess.js:457
// Here is the error stack:  f:\vscode-python\node_modules\monaco-editor\esm\vs\editor\editor.api.js:5
// import { EDITOR_DEFAULTS } from './common/config/editorOptions.js';
// Instead just use a map
function convertToMonacoCompletionItemKind(kind?: number): number {
    const value = kind ? mapCompletionItemKind.get(kind) : 9; // Property is 9
    if (value) {
        return value;
    }
    return 9; // Property
}

function convertToMonacoCompletionItem(item: vscodeLanguageClient.CompletionItem, requiresKindConversion: boolean): monacoEditor.languages.CompletionItem {
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

    // Make sure we don't have _documentPosition. It holds onto a huge tree of information
    // tslint:disable-next-line: no-any
    const resultAny = result as any;
    if (resultAny._documentPosition) {
        delete resultAny._documentPosition;
    }

    return result;
}

export function convertToMonacoCompletionList(
    result: vscodeLanguageClient.CompletionList | vscodeLanguageClient.CompletionItem[] | vscode.CompletionItem[] | vscode.CompletionList | null,
    requiresKindConversion: boolean): monacoEditor.languages.CompletionList {
    if (result) {
        if (result.hasOwnProperty('items')) {
            const list = result as vscodeLanguageClient.CompletionList;
            return {
                suggestions: list.items.map(l => convertToMonacoCompletionItem(l, requiresKindConversion)),
                incomplete: list.isIncomplete
            };
        } else {
            // Must be one of the two array types since there's no items property.
            const array = result as vscodeLanguageClient.CompletionItem[];
            return {
                suggestions: array.map(l => convertToMonacoCompletionItem(l, requiresKindConversion)),
                incomplete: false
            };
        }
    }

    return {
        suggestions: [],
        incomplete: false
    };
}

function convertToMonacoMarkdown(strings: vscodeLanguageClient.MarkupContent | vscodeLanguageClient.MarkedString | vscodeLanguageClient.MarkedString[] | vscode.MarkedString | vscode.MarkedString[]): monacoEditor.IMarkdownString[] {
    if (strings.hasOwnProperty('kind')) {
        const content = strings as vscodeLanguageClient.MarkupContent;
        return [
            {
                value: content.value
            }
        ];
    } else if (strings.hasOwnProperty('value')) {
        // tslint:disable-next-line: no-any
        const content = strings as any;
        return [
            {
                value: content.value
            }
        ];
    } else if (typeof strings === 'string') {
        return [
            {
                value: strings.toString()
            }
        ];
    } else if (Array.isArray(strings)) {
        const array = strings as vscodeLanguageClient.MarkedString[];
        return array.map(a => convertToMonacoMarkdown(a)[0]);
    }

    return [];
}

export function convertToMonacoHover(result: vscodeLanguageClient.Hover | vscode.Hover | null | undefined): monacoEditor.languages.Hover {
    if (result) {
        return {
            contents: convertToMonacoMarkdown(result.contents),
            range: convertToMonacoRange(result.range)
        };
    }

    return {
        contents: []
    };
}

// tslint:disable-next-line: no-any
export function convertStringsToSuggestions(strings: ReadonlyArray<string>, range: monacoEditor.IRange, metadata: any): monacoEditor.languages.CompletionItem[] {
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
            range
        };
    });
}

export function convertToMonacoSignatureHelp(
    result: vscodeLanguageClient.SignatureHelp | vscode.SignatureHelp | null): monacoEditor.languages.SignatureHelp {
    if (result) {
        return result as monacoEditor.languages.SignatureHelp;
    }

    return {
        signatures: [],
        activeParameter: 0,
        activeSignature: 0
    };
}
