// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import * as path from 'path';
import * as uuid from 'uuid/v4';
import { CancellationToken } from 'vscode';

import { IWorkspaceService } from '../../../common/application/types';
import { IFileSystem } from '../../../common/platform/types';
import { IAsyncDisposable, IConfigurationService } from '../../../common/types';
import { INotebookServer, INotebookServerOptions } from '../../types';

export class ServerCache implements IAsyncDisposable {
    private cache: Map<string, Promise<INotebookServer | undefined>> = new Map<string, Promise<INotebookServer | undefined>>();
    private emptyKey = uuid();

    constructor(private configService: IConfigurationService, private workspace: IWorkspaceService, private fileSystem: IFileSystem) {}

    public async getOrCreate(
        createFunction: (options?: INotebookServerOptions, cancelToken?: CancellationToken) => Promise<INotebookServer | undefined>,
        options?: INotebookServerOptions,
        cancelToken?: CancellationToken
    ): Promise<INotebookServer | undefined> {
        const fixedOptions = await this.generateDefaultOptions(options);
        const key = this.generateKey(fixedOptions);
        let createPromise: Promise<INotebookServer | undefined> | undefined;

        // Check to see if we already have a promise for this key
        createPromise = this.cache.get(key);

        if (!createPromise) {
            // Didn't find one, so start up our promise and cache it
            const newCreatePromise = createFunction(options, cancelToken);
            this.cache.set(key, newCreatePromise);
            createPromise = newCreatePromise;
        }

        return createPromise
            .then((server: INotebookServer | undefined) => {
                if (!server) {
                    this.cache.delete(key);
                    return undefined;
                }

                // Change the dispose on it so we
                // can detach from the server when it goes away.
                const oldDispose = server.dispose.bind(server);
                server.dispose = () => {
                    this.cache.delete(key);
                    return oldDispose();
                };

                return server;
            })
            .catch(e => {
                this.cache.delete(key);
                throw e;
            });
    }

    public async get(options?: INotebookServerOptions): Promise<INotebookServer | undefined> {
        const fixedOptions = await this.generateDefaultOptions(options);
        const key = this.generateKey(fixedOptions);
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
    }

    public async dispose(): Promise<void> {
        await Promise.all(
            [...this.cache.values()].map(async serverPromise => {
                const server = await serverPromise;
                await server?.dispose();
            })
        );
        this.cache.clear();
    }

    public async generateDefaultOptions(options?: INotebookServerOptions): Promise<INotebookServerOptions> {
        return {
            enableDebugging: options ? options.enableDebugging : false,
            uri: options ? options.uri : undefined,
            useDefaultConfig: options ? options.useDefaultConfig : true, // Default for this is true.
            usingDarkTheme: options ? options.usingDarkTheme : undefined,
            purpose: options ? options.purpose : uuid(),
            workingDir: options && options.workingDir ? options.workingDir : await this.calculateWorkingDirectory(),
            metadata: options?.metadata
        };
    }

    private generateKey(options?: INotebookServerOptions): string {
        if (!options) {
            return this.emptyKey;
        } else {
            // combine all the values together to make a unique key
            const uri = options.uri ? options.uri : '';
            const useFlag = options.useDefaultConfig ? 'true' : 'false';
            const debug = options.enableDebugging ? 'true' : 'false';
            return `${options.purpose}${uri}${useFlag}${options.workingDir}${debug}`;
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
            } else if (!fileRoot.includes('${')) {
                // fileRoot is a relative path, combine it with the workspace folder
                const combinedPath = path.join(workspaceFolderPath, fileRoot);
                if (await this.fileSystem.directoryExists(combinedPath)) {
                    // combined path exists, use it
                    workingDir = combinedPath;
                } else {
                    // Combined path doesn't exist, use workspace
                    workingDir = workspaceFolderPath;
                }
            } else {
                // fileRoot is a variable that hasn't been expanded
                workingDir = fileRoot;
            }
        }
        return workingDir;
    }
}
