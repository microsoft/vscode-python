// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { injectable, inject } from 'inversify';
import { Uri, workspace } from 'vscode';
import { IPythonStartupEnvVarService } from '../types';
import { IExtensionContext } from '../../common/types';
import { EXTENSION_ROOT_DIR } from '../../constants';

@injectable()
export class PythonStartupEnvVarService implements IPythonStartupEnvVarService {
    constructor(@inject(IExtensionContext) private context: IExtensionContext) {}

    public async register(): Promise<void> {
        const storageUri = this.context.storageUri || this.context.globalStorageUri;
        try {
            await workspace.fs.createDirectory(storageUri);
        } catch {
            // already exists, most likely
        }
        const destPath = Uri.joinPath(storageUri, 'pythonrc.py');

        // TODO: Only do this when we have a setting
        // Rollout strategy:
        // Stage 1. Opt-in setting in stable/insiders
        // Stage 2. Out-out setting in insiders
        // Stage 3. Out-out setting in stable (or experiment?)
        const sourcePath = path.join(EXTENSION_ROOT_DIR, 'python_files', 'pythonrc.py');

        await workspace.fs.copy(Uri.file(sourcePath), destPath, { overwrite: true });

        this.context.environmentVariableCollection.replace('PYTHONSTARTUP', destPath.fsPath);
    }
}
