// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { FileSystemWatcher, RelativePattern, WorkspaceFolder, WorkspaceFoldersChangeEvent } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { IWorkspaceService } from '../common/application/types';
import { NativeTensorBoard } from '../common/experiments/groups';
import { traceError } from '../common/logger';
import { IDisposableRegistry, IExperimentService } from '../common/types';
import { TensorBoardPrompt } from './tensorBoardPrompt';

@injectable()
export class TensorBoardFileWatcher implements IExtensionSingleActivationService {
    private fileSystemWatchers = new Map<WorkspaceFolder, FileSystemWatcher[]>();

    private globPattern1 = '*tfevents*';

    private globPattern2 = '*/*tfevents*';

    constructor(
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
        @inject(TensorBoardPrompt) private tensorBoardPrompt: TensorBoardPrompt,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(IExperimentService) private experimentService: IExperimentService,
    ) {}

    public async activate(): Promise<void> {
        this.activateInternal().ignoreErrors();
    }

    private async activateInternal() {
        if (!(await this.experimentService.inExperiment(NativeTensorBoard.experiment))) {
            return;
        }

        const folders = this.workspaceService.workspaceFolders;
        if (!folders) {
            return;
        }

        // Look for pre-existing tfevent files, as the file watchers will only pick up files
        // created or changed after they have been registered and hooked up. Just one will do.
        await this.promptIfWorkspaceHasPreexistingFiles();

        // If the user creates or changes tfevent files, listen for those too
        for (const folder of folders) {
            this.createFileSystemWatcher(folder);
        }

        // If workspace folders change, ensure we update our FileSystemWatchers
        this.disposables.push(
            this.workspaceService.onDidChangeWorkspaceFolders((e) => this.updateFileSystemWatchers(e)),
        );
    }

    private async promptIfWorkspaceHasPreexistingFiles() {
        try {
            for (const pattern of [this.globPattern1, this.globPattern2]) {
                const matches = await this.workspaceService.findFiles(pattern, undefined, 1);
                if (matches.length > 0) {
                    await this.tensorBoardPrompt.showNativeTensorBoardPrompt();
                    return;
                }
            }
        } catch (e) {
            traceError(
                `Failed to prompt to launch TensorBoard session based on preexisting tfevent files in workspace: ${e}`,
            );
        }
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
        for (const pattern of [this.globPattern1, this.globPattern2]) {
            const relativePattern = new RelativePattern(folder, pattern);
            const fileSystemWatcher = this.workspaceService.createFileSystemWatcher(relativePattern);

            // When a file is created or changed that matches `this.globPattern`, try to show our prompt
            this.disposables.push(
                fileSystemWatcher.onDidCreate(() => this.tensorBoardPrompt.showNativeTensorBoardPrompt()),
            );
            this.disposables.push(
                fileSystemWatcher.onDidChange(() => this.tensorBoardPrompt.showNativeTensorBoardPrompt()),
            );
            this.disposables.push(fileSystemWatcher);
            fileWatchers.push(fileSystemWatcher);
        }
        this.fileSystemWatchers.set(folder, fileWatchers);
    }
}
