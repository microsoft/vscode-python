// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CancellationToken, Uri, WorkspaceEdit } from 'vscode';

export const ISortImportsEditingProvider = Symbol('ISortImportsEditingProvider');
export interface ISortImportsEditingProvider {
    provideDocumentSortImportsEdits(uri: Uri, token?: CancellationToken): Promise<WorkspaceEdit | undefined>;
    sortImports(uri?: Uri): Promise<void>;
    registerCommands(): void;
}
