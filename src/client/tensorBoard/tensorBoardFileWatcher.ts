// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { FileSystemWatcher, RelativePattern, WorkspaceFolder, WorkspaceFoldersChangeEvent } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { IWorkspaceService } from '../common/application/types';
import { IDisposableRegistry } from '../common/types';
import { TensorBoardEntrypointTrigger } from './constants';
import { TensorBoardPrompt } from './tensorBoardPrompt';
import { useNewTensorboardExtension } from './tensorboarExperiment';

@injectable()
export class TensorBoardFileWatcher implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };

    private fileSystemWatchers = new Map<WorkspaceFolder, FileSystemWatcher[]>();

    private globPatterns = ['*tfevents*', '*/*tfevents*', '*/*/*tfevents*'];

    constructor(
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
        @inject(TensorBoardPrompt) private tensorBoardPrompt: TensorBoardPrompt,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
    ) {}

    public async activate(): Promise<void> {
        if (useNewTensorboardExtension()) {
            return;
        }
        this.activateInternal().ignoreErrors();
    }

    private async activateInternal() {
        const folders = this.workspaceService.workspaceFolders;
        if (!folders) {
            return;
        }

        // If the user creates or changes tfevent files, listen for those too
        for (const folder of folders) {
            this.createFileSystemWatcher(folder);
        }

        // If workspace folders change, ensure we update our FileSystemWatchers
        this.disposables.push(
            this.workspaceService.onDidChangeWorkspaceFolders((e) => this.updateFileSystemWatchers(e)),
        );
    }

    private async updateFileSystemWatchers(event: WorkspaceFoldersChangeEvent) {
        for (const added of event.added) {
            this.createFileSystemWatcher(added);
        }
        for (const removed of event.removed) {
            const fileSystemWatchers = this.fileSystemWatchers.get(removed);
            if (fileSystemWatchers) {
                fileSystemWatchers.forEach((fileWatcher) => fileWatcher.dispose());
                this.fileSystemWatchers.delete(removed);
            }
        }
    }

    private createFileSystemWatcher(folder: WorkspaceFolder) {
        const fileWatchers = [];
        for (const pattern of this.globPatterns) {
            const relativePattern = new RelativePattern(folder, pattern);
            const fileSystemWatcher = this.workspaceService.createFileSystemWatcher(relativePattern);

            // When a file is created or changed that matches `this.globPattern`, try to show our prompt
            this.disposables.push(
                fileSystemWatcher.onDidCreate(() =>
                    this.tensorBoardPrompt.showNativeTensorBoardPrompt(TensorBoardEntrypointTrigger.tfeventfiles),
                ),
            );
            this.disposables.push(
                fileSystemWatcher.onDidChange(() =>
                    this.tensorBoardPrompt.showNativeTensorBoardPrompt(TensorBoardEntrypointTrigger.tfeventfiles),
                ),
            );
            this.disposables.push(fileSystemWatcher);
            fileWatchers.push(fileSystemWatcher);
        }
        this.fileSystemWatchers.set(folder, fileWatchers);
    }
}
