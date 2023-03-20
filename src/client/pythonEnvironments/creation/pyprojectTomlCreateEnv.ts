// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TextDocument, TextDocumentChangeEvent } from 'vscode';
import { IDisposableRegistry } from '../../common/types';
import { executeCommand } from '../../common/vscodeApis/commandApis';
import {
    onDidOpenTextDocument,
    onDidChangeTextDocument,
    getOpenTextDocuments,
} from '../../common/vscodeApis/workspaceApis';
import { isPipInstallableToml } from './provider/venvUtils';

async function setPyProjectTomlContextKey(doc: TextDocument): Promise<void> {
    if (isPipInstallableToml(doc.getText())) {
        await executeCommand('setContext', 'pipInstallableToml', true);
    } else {
        await executeCommand('setContext', 'pipInstallableToml', false);
    }
}

export function registerPyProjectTomlCreateEnvFeatures(disposables: IDisposableRegistry): void {
    disposables.push(
        onDidOpenTextDocument(async (doc: TextDocument) => {
            if (doc.fileName.endsWith('pyproject.toml')) {
                await setPyProjectTomlContextKey(doc);
            }
        }),
        onDidChangeTextDocument(async (e: TextDocumentChangeEvent) => {
            if (e.document.fileName.endsWith('pyproject.toml')) {
                await setPyProjectTomlContextKey(e.document);
            }
        }),
    );

    getOpenTextDocuments().forEach(async (doc: TextDocument) => {
        if (doc.fileName.endsWith('pyproject.toml')) {
            await setPyProjectTomlContextKey(doc);
        }
    });
}
