// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TextDocument, TextDocumentChangeEvent } from 'vscode';
import { IDisposableRegistry } from '../../common/types';
import { executeCommand } from '../../common/vscodeApis/commandApis';
import {
    onDidOpenTextDocument,
    onDidChangeTextDocument,
    getOpenTextDocuments,
    getConfiguration,
    onDidChangeConfiguration,
} from '../../common/vscodeApis/workspaceApis';
import { isPipInstallableToml } from './provider/venvUtils';

async function setPyProjectTomlContextKey(doc: TextDocument): Promise<void> {
    if (isPipInstallableToml(doc.getText())) {
        await executeCommand('setContext', 'pipInstallableToml', true);
    } else {
        await executeCommand('setContext', 'pipInstallableToml', false);
    }
}

async function setShowCreateEnvButtonContextKey(): Promise<void> {
    const config = getConfiguration('python');
    const showCreateEnvButton = config.get<string>('createEnvironment.contentButton', 'show') === 'show';
    await executeCommand('setContext', 'showCreateEnvButton', showCreateEnvButton);
}

export function registerCreateEnvButtonFeatures(disposables: IDisposableRegistry): void {
    disposables.push(
        onDidOpenTextDocument(async (doc: TextDocument) => {
            if (doc.fileName.endsWith('pyproject.toml')) {
                await setPyProjectTomlContextKey(doc);
            }
        }),
        onDidChangeTextDocument(async (e: TextDocumentChangeEvent) => {
            const doc = e.document;
            if (doc.fileName.endsWith('pyproject.toml')) {
                await setPyProjectTomlContextKey(doc);
            }
        }),
        onDidChangeConfiguration(async () => {
            await setShowCreateEnvButtonContextKey();
        }),
    );

    setShowCreateEnvButtonContextKey();

    const docs = getOpenTextDocuments().filter(
        (doc) => doc.fileName.endsWith('pyproject.toml') && isPipInstallableToml(doc.getText()),
    );
    if (docs.length > 0) {
        executeCommand('setContext', 'pipInstallableToml', true);
    } else {
        executeCommand('setContext', 'pipInstallableToml', false);
    }
}
