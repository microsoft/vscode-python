// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { FileSystemWatcher, RelativePattern, WorkspaceFolder, WorkspaceFoldersChangeEvent } from 'vscode';
import { IExtensionActivationService } from '../activation/types';
import { IWorkspaceService } from '../common/application/types';
import { TensorBoardPrompt } from './tensorBoardPrompt';

@injectable()
export class TensorBoardFileWatcher implements IExtensionActivationService {
    private fileSystemWatchers = new Map<WorkspaceFolder, FileSystemWatcher>();
    private globPattern = '**/*tfevents*';

    constructor(
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
        @inject(TensorBoardPrompt) private tensorBoardPrompt: TensorBoardPrompt
    ) {}

    public async activate() {
        const folders = this.workspaceService.workspaceFolders;
        if (!folders) {
            return;
        }

        // Look for existing tfevent files. Just one will do
        this.workspaceService.findFiles(this.globPattern, undefined, 1).then(async (matches) => {
            if (matches.length > 0) {
                await this.tensorBoardPrompt.showNativeTensorBoardPrompt();
            }
        });

        // If the user creates or changes tfevent files, listen for those too
        for (const folder of folders) {
            this.createFileSystemWatcher(folder);
        }

        // If workspace folders change, ensure we update our FileSystemWatchers
        this.workspaceService.onDidChangeWorkspaceFolders((e) => this.updateFileSystemWatchers(e));
    }

    private async updateFileSystemWatchers(event: WorkspaceFoldersChangeEvent) {
        for (const added of event.added) {
            this.createFileSystemWatcher(added);
        }
        for (const removed of event.removed) {
            const fileSystemWatcher = this.fileSystemWatchers.get(removed);
            if (fileSystemWatcher) {
                fileSystemWatcher.dispose();
                this.fileSystemWatchers.delete(removed);
            }
        }
    }

    private createFileSystemWatcher(folder: WorkspaceFolder) {
        const relativePattern = new RelativePattern(folder, this.globPattern);
        const fileSystemWatcher = this.workspaceService.createFileSystemWatcher(relativePattern);
        // When a file is created or changed that matches `this.globPattern`, try to show our prompt
        fileSystemWatcher.onDidCreate((_uri) => this.tensorBoardPrompt.showNativeTensorBoardPrompt());
        fileSystemWatcher.onDidChange((_uri) => this.tensorBoardPrompt.showNativeTensorBoardPrompt());
        this.fileSystemWatchers.set(folder, fileSystemWatcher);
    }
}
