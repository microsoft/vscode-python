// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import type { NotebookContentProvider as VSCodeNotebookContentProvider } from 'vscode-proposed';

export const INotebookContentProvider = Symbol('INotebookContentProvider');
export interface INotebookContentProvider extends VSCodeNotebookContentProvider {}
