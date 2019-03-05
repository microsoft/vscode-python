// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import * as path from 'path';
import * as uuid from 'uuid/v4';

import { IWorkspaceService } from '../../../common/application/types';
import { IFileSystem } from '../../../common/platform/types';
import { IAsyncDisposable, IConfigurationService } from '../../../common/types';
import { INotebookServer, INotebookServerOptions } from '../../types';

export class ServerCache implements IAsyncDisposable {
    private cache: Map<string, INotebookServer> = new Map<string, INotebookServer>();
    private emptyKey = uuid();

    constructor(
        private configService: IConfigurationService,
        private workspace: IWorkspaceService,
        private fileSystem: IFileSystem
    ) { }

    public async get(options?: INotebookServerOptions): Promise<INotebookServer | undefined> {
        const fixedOptions = await this.generateDefaultOptions(options);
        const key = this.generateKey(fixedOptions);
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
    }

    public async set(result: INotebookServer, disposeCallback: () => void, options?: INotebookServerOptions): Promise<void> {
        const fixedOptions = await this.generateDefaultOptions(options);
        const key = this.generateKey(fixedOptions);

        // Eliminate any already with this key
        const item = this.cache.get(key);
        if (item) {
            await item.dispose();
        }

        // Save in our cache.
        this.cache.set(key, result);

        // Save this result, but modify its dispose such that we
        // can detach from the server when it goes away.
        const oldDispose = result.dispose.bind(result);
        result.dispose = () => {
            this.cache.delete(key);
            disposeCallback();
            return oldDispose();
        };
    }

    public async dispose(): Promise<void> {
        for (const [, s] of this.cache) {
            await s.dispose();
        }
        this.cache.clear();
    }

    public async generateDefaultOptions(options?: INotebookServerOptions): Promise<INotebookServerOptions> {
        return {
            uri: options ? options.uri : undefined,
            useDefaultConfig: options ? options.useDefaultConfig : true, // Default for this is true.
            usingDarkTheme: options ? options.usingDarkTheme : undefined,
            purpose: options ? options.purpose : uuid(),
            workingDir: options && options.workingDir ? options.workingDir : await this.calculateWorkingDirectory()
        };
    }

    private generateKey(options?: INotebookServerOptions): string {
        if (!options) {
            return this.emptyKey;
        } else {
            // combine all the values together to make a unique key
            return options.purpose +
                (options.uri ? options.uri : '') +
                (options.useDefaultConfig ? 'true' : 'false') +
                (options.usingDarkTheme ? 'true' : 'false') + // Ideally we'd have different results for different themes. Not sure how to handle this.
                (options.workingDir);
        }
    }

    private async calculateWorkingDirectory(): Promise<string | undefined> {
        let workingDir: string | undefined;
        // For a local launch calculate the working directory that we should switch into
        const settings = this.configService.getSettings();
        const fileRoot = settings.datascience.notebookFileRoot;

        // If we don't have a workspace open the notebookFileRoot seems to often have a random location in it (we use ${workspaceRoot} as default)
        // so only do this setting if we actually have a valid workspace open
        if (fileRoot && this.workspace.hasWorkspaceFolders) {
            const workspaceFolderPath = this.workspace.workspaceFolders![0].uri.fsPath;
            if (path.isAbsolute(fileRoot)) {
                if (await this.fileSystem.directoryExists(fileRoot)) {
                    // User setting is absolute and exists, use it
                    workingDir = fileRoot;
                } else {
                    // User setting is absolute and doesn't exist, use workspace
                    workingDir = workspaceFolderPath;
                }
            } else {
                // fileRoot is a relative path, combine it with the workspace folder
                const combinedPath = path.join(workspaceFolderPath, fileRoot);
                if (await this.fileSystem.directoryExists(combinedPath)) {
                    // combined path exists, use it
                    workingDir = combinedPath;
                } else {
                    // Combined path doesn't exist, use workspace
                    workingDir = workspaceFolderPath;
                }
            }
        }
        return workingDir;
    }

}
