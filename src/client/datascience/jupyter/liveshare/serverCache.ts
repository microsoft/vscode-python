// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../../common/extensions';

import * as uuid from 'uuid/v4';
import { CancellationToken, CancellationTokenSource } from 'vscode';

import { IWorkspaceService } from '../../../common/application/types';
import { IFileSystem } from '../../../common/platform/types';
import { IAsyncDisposable, IConfigurationService } from '../../../common/types';
import { sleep } from '../../../common/utils/async';
import { traceError, traceInfo } from '../../../logging';
import { INotebookServer, INotebookServerOptions } from '../../types';
import { calculateWorkingDirectory } from '../../utils';

interface IServerData {
    options: INotebookServerOptions;
    promise: Promise<INotebookServer | undefined>;
    cancelSource: CancellationTokenSource;
    resolved: boolean;
}

export class ServerCache implements IAsyncDisposable {
    private cache: Map<string, IServerData> = new Map<string, IServerData>();
    private emptyKey = uuid();
    private disposed = false;

    constructor(
        private configService: IConfigurationService,
        private workspace: IWorkspaceService,
        private fileSystem: IFileSystem
    ) {}

    public async getOrCreate(
        createFunction: (
            options?: INotebookServerOptions,
            cancelToken?: CancellationToken
        ) => Promise<INotebookServer | undefined>,
        options?: INotebookServerOptions,
        cancelToken?: CancellationToken
    ): Promise<INotebookServer | undefined> {
        const cancelSource = new CancellationTokenSource();
        if (cancelToken) {
            cancelToken.onCancellationRequested(() => cancelSource.cancel());
        }
        const fixedOptions = await this.generateDefaultOptions(options);
        const key = this.generateKey(fixedOptions);
        let data: IServerData | undefined;

        // Check to see if we already have a promise for this key
        data = this.cache.get(key);

        if (!data) {
            // Didn't find one, so start up our promise and cache it
            data = {
                promise: createFunction(options, cancelSource.token),
                options: fixedOptions,
                cancelSource,
                resolved: false
            };
            this.cache.set(key, data);
        }

        return data.promise
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

                // We've resolved the promise at this point
                if (data) {
                    data.resolved = true;
                }

                return server;
            })
            .catch((e) => {
                this.cache.delete(key);
                throw e;
            });
    }

    public async get(options?: INotebookServerOptions): Promise<INotebookServer | undefined> {
        const fixedOptions = await this.generateDefaultOptions(options);
        const key = this.generateKey(fixedOptions);
        if (this.cache.has(key)) {
            return this.cache.get(key)?.promise;
        }
    }

    public async dispose(): Promise<void> {
        if (!this.disposed) {
            this.disposed = true;
            const entries = [...this.cache.values()];
            this.cache.clear();
            await Promise.all(
                entries.map(async (d) => {
                    try {
                        // This should be quick. The server is either already up or will never come back.
                        const server = await Promise.race([d.promise, sleep(1000)]);
                        if (typeof server !== 'number') {
                            // tslint:disable-next-line: no-any
                            await (server as any).dispose();
                        } else {
                            traceInfo('ServerCache Dispose, no server');
                        }
                    } catch (e) {
                        traceError(`Dispose error in ServerCache: `, e);
                    }
                })
            );
        }
    }

    public async generateDefaultOptions(options?: INotebookServerOptions): Promise<INotebookServerOptions> {
        return {
            uri: options ? options.uri : undefined,
            skipUsingDefaultConfig: options ? options.skipUsingDefaultConfig : false, // Default for this is false
            usingDarkTheme: options ? options.usingDarkTheme : undefined,
            purpose: options ? options.purpose : uuid(),
            workingDir:
                options && options.workingDir
                    ? options.workingDir
                    : await calculateWorkingDirectory(this.configService, this.workspace, this.fileSystem),
            metadata: options?.metadata,
            allowUI: options?.allowUI ? options.allowUI : () => false
        };
    }

    private generateKey(options?: INotebookServerOptions): string {
        if (!options) {
            return this.emptyKey;
        } else {
            // combine all the values together to make a unique key
            const uri = options.uri ? options.uri : '';
            const useFlag = options.skipUsingDefaultConfig ? 'true' : 'false';
            return `${options.purpose}${uri}${useFlag}${options.workingDir}`;
        }
    }
}
