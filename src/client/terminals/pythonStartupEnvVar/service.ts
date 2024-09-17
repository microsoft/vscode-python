// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { injectable, inject } from 'inversify';
import { Uri, workspace } from 'vscode';
import { IPythonStartupEnvVarService } from '../types';
import { IConfigurationService, IExtensionContext } from '../../common/types';
import { EXTENSION_ROOT_DIR } from '../../constants';

@injectable()
export class PythonStartupEnvVarService implements IPythonStartupEnvVarService {
    constructor(
        @inject(IExtensionContext) private context: IExtensionContext,
        @inject(IConfigurationService) private configurationService: IConfigurationService,
    ) {}

    public async register(): Promise<void> {
        const storageUri = this.context.storageUri || this.context.globalStorageUri;
        try {
            await workspace.fs.createDirectory(storageUri);
        } catch {
            // already exists, most likely
        }
        const destPath = Uri.joinPath(storageUri, 'pythonrc.py');

        const sourcePath = path.join(EXTENSION_ROOT_DIR, 'python_files', 'pythonrc.py');

        await workspace.fs.copy(Uri.file(sourcePath), destPath, { overwrite: true });
        const pythonrcSetting = this.configurationService.getSettings().REPL.enableShellIntegration;
        // TODO: Is there better place to set this?
        if (pythonrcSetting) {
            this.context.environmentVariableCollection.replace('PYTHONSTARTUP', destPath.fsPath);
        } else {
            this.context.environmentVariableCollection.delete('PYTHONSTARTUP');
        }
    }
}
