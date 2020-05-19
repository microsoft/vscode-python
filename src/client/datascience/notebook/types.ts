// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CancellationToken, NotebookCell, NotebookDocument } from 'vscode';

export const INotebookExecutionService = Symbol('INotebookExecutionService');
export interface INotebookExecutionService {
    executeCell(document: NotebookDocument, cell: NotebookCell, token: CancellationToken): Promise<void>;
    executeAllCells(document: NotebookDocument, token: CancellationToken): Promise<void>;
}
