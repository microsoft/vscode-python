// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Position, SymbolKind } from 'vscode';

export interface ITag {
    fileName: string;
    symbolName: string;
    symbolKind: SymbolKind;
    position: Position;
    code: string;
}
