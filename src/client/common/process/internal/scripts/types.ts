// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// Completion

export type CompletionResponse = (_Response1 | _Response2) & {
    id: number;
};
type _Response1 = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    arguments: any[];
};
type _Response2 =
    | AutoCompleteResponse
    | HoverResponse
    | DefinitionResponse
    | ReferenceResponse
    | SymbolResponse
    | ArgumentsResponse;

type AutoCompleteResponse = {
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
    // eslint-disable-next-line camelcase
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

// Symbol providers

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
export type SymbolProviderSymbols = {
    classes: RawSymbol[];
    methods: RawSymbol[];
    functions: RawSymbol[];
};
