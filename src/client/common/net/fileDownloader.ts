// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IHttpClient, IFileDownloader, DownloadOptions } from '../types';
import { IFileSystem } from '../platform/types';
import { IApplicationShell } from '../application/types';
import { createDeferred } from '../utils/async';
import { ProgressLocation, Progress } from 'vscode';
import { WriteStream } from 'fs';
import * as requestTypes from 'request';

@injectable()
export class FileDownloader implements IFileDownloader {
    constructor(@inject(IHttpClient) private readonly httpClient: IHttpClient,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell) {
    }
    public async downloadFile(uri: string, options: DownloadOptions): Promise<string> {
        if (options.outputChannel) {
            options.outputChannel.append(`Downloading ${uri}... `);
        }
        const tempFile = await this.fs.createTemporaryFile(options.extension);

        const deferred = createDeferred();
        const fileStream = this.fs.createWriteStream(tempFile.filePath);
        fileStream
            .on('finish', () => fileStream.close())
            .on('error', (err) => {
                tempFile.dispose();
                deferred.reject(err);
            });

        await this.appShell.withProgress({ location: ProgressLocation.Window }, async (progress) => {
            const req = await this.httpClient.downloadFile(uri);
            req.on('response', (response) => {
                if (response.statusCode !== 200) {
                    const error = new Error(`Failed with status ${response.statusCode}, ${response.statusMessage}, Uri ${uri}`);
                    deferred.reject(error);
                    throw error;
                }
            });
            // Download.
            this.displayDownloadProgress(progress, req, fileStream, options.progressMessagePrefix)
                .then(deferred.resolve.bind(deferred))
                .catch(deferred.reject.bind(deferred));

            return deferred.promise;
        });

        return tempFile.filePath;
    }

    public async displayDownloadProgress(progress: Progress<{ message?: string; increment?: number }>,
        request: requestTypes.Request,
        fileStream: WriteStream, progressMessagePrefix: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const requestProgress = require('request-progress');
            requestProgress(request)
                .on('progress', (state: any) => {
                    // https://www.npmjs.com/package/request-progress
                    const received = Math.round(state.size.transferred / 1024);
                    const total = Math.round(state.size.total / 1024);
                    const percentage = Math.round(100 * state.percent);
                    progress.report({
                        message: `${progressMessagePrefix}${received} of ${total} KB (${percentage}%)`
                    });
                })
                .on('error', (err: any) => {
                    reject(err);
                })
                .on('end', () => {
                    resolve();
                })
                .pipe(fileStream);
        });
    }
}