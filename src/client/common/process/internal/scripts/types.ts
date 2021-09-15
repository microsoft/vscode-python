// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

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
