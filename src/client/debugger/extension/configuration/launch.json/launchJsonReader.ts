// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { parse } from 'jsonc-parser';
import { inject, injectable } from 'inversify';
import { DebugConfiguration, Uri, WorkspaceFolder } from 'vscode';
import { IFileSystem } from '../../../../common/platform/types';
import { ILaunchJsonReader } from '../types';
import { IWorkspaceService } from '../../../../common/application/types';

@injectable()
export class LaunchJsonReader implements ILaunchJsonReader {
    constructor(
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
    ) {}

    public async getConfigurationsForWorkspace(workspace: WorkspaceFolder): Promise<DebugConfiguration[]> {
        const filename = path.join(workspace.uri.fsPath, '.vscode', 'launch.json');

        if (!(await this.fs.fileExists(filename))) {
            return [];
        }

        const text = await this.fs.readFile(filename);
        const parsed = parse(text, [], { allowTrailingComma: true, disallowComments: false });
        if (!parsed.configurations || !Array.isArray(parsed.configurations)) {
            throw Error('Missing field in launch.json: configurations');
        }
        if (!parsed.version) {
            throw Error('Missing field in launch.json: version');
        }
        // We do not bother ensuring each item is a DebugConfiguration...
        return parsed.configurations;
    }

    public async getConfigurationsByUri(uri: Uri): Promise<DebugConfiguration[]> {
        const workspace = this.workspaceService.getWorkspaceFolder(uri);
        if (workspace) {
            return this.getConfigurationsForWorkspace(workspace);
        }
        return [];
    }
}
