// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import { isNotebookCell } from '../../common/utils/misc';

export class PythonCodeActionProvider implements vscode.CodeActionProvider {
    public provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range,
        _context: vscode.CodeActionContext,
        _token: vscode.CancellationToken,
    ): vscode.ProviderResult<vscode.CodeAction[]> {
        if (isNotebookCell(document)) {
            return [];
        }
        const sortImports = new vscode.CodeAction('Sort imports', vscode.CodeActionKind.SourceOrganizeImports);
        sortImports.command = {
            title: 'Sort imports',
            command: 'python.sortImports',
        };

        return [sortImports];
    }
}
