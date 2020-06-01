// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import type { CancellationToken } from 'vscode';
import type { NotebookCell, NotebookDocument } from 'vscode-proposed';

export const INotebookExecutionService = Symbol('INotebookExecutionService');
export interface INotebookExecutionService {
    cancelPendingExecutions(document: NotebookDocument): void;
    executeCell(document: NotebookDocument, cell: NotebookCell, token: CancellationToken): Promise<void>;
    executeAllCells(document: NotebookDocument, token: CancellationToken): Promise<void>;
}
