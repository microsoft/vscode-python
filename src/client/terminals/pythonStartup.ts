// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ExtensionContext, Uri } from 'vscode';
import * as path from 'path';
import { copy, createDirectory, getConfiguration } from '../common/vscodeApis/workspaceApis';
import { EXTENSION_ROOT_DIR } from '../constants';

export async function registerPythonStartup(context: ExtensionContext): Promise<void> {
    const config = getConfiguration('python');
    const pythonrcSetting = config.get<boolean>('terminal.shellIntegration.enabled');

    if (pythonrcSetting) {
        const storageUri = context.storageUri || context.globalStorageUri;
        try {
            await createDirectory(storageUri);
        } catch {
            // already exists, most likely
        }
        const destPath = Uri.joinPath(storageUri, 'pythonrc.py');
        const sourcePath = path.join(EXTENSION_ROOT_DIR, 'python_files', 'pythonrc.py');
        await copy(Uri.file(sourcePath), destPath, { overwrite: true });
        context.environmentVariableCollection.replace('PYTHONSTARTUP', destPath.fsPath);
    } else {
        context.environmentVariableCollection.delete('PYTHONSTARTUP');
    }
}
