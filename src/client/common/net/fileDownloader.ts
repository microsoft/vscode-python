// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as requestTypes from 'request';
import { StatusBarAlignment, StatusBarItem } from 'vscode';
import { IApplicationShell } from '../application/types';
import { Octicons } from '../constants';
import { IFileSystem, WriteStream } from '../platform/types';
import { DownloadOptions, IFileDownloader, IHttpClient } from '../types';
import { Http } from '../utils/localize';
import { noop } from '../utils/misc';

@injectable()
export class FileDownloader implements IFileDownloader {
    constructor(
        @inject(IHttpClient) private readonly httpClient: IHttpClient,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell
    ) {}
    public async downloadFile(uri: string, options: DownloadOptions): Promise<string> {
        if (options.outputChannel) {
            options.outputChannel.appendLine(Http.downloadingFile().format(uri));
        }
        const tempFile = await this.fs.createTemporaryFile(options.extension);

        await this.downloadFileWithStatusBarProgress(uri, options.progressMessagePrefix, tempFile.filePath).then(
            noop,
            (ex) => {
                tempFile.dispose();
                return Promise.reject(ex);
            }
        );

        return tempFile.filePath;
    }
    public async downloadFileWithStatusBarProgress(
        uri: string,
        progressMessage: string,
        tmpFilePath: string
    ): Promise<void> {
        const statusBarProgress = this.appShell.createStatusBarItem(StatusBarAlignment.Left);
        const req = await this.httpClient.downloadFile(uri);
        const fileStream = this.fs.createWriteStream(tmpFilePath);
        const progressMessageWithIcon = `${Octicons.Downloading} ${progressMessage}`;
        statusBarProgress.show();
        try {
            await this.displayDownloadProgress(uri, statusBarProgress, req, fileStream, progressMessageWithIcon);
        } finally {
            statusBarProgress.dispose();
        }
    }

    public async displayDownloadProgress(
        uri: string,
        statusBarProgress: StatusBarItem,
        request: requestTypes.Request,
        fileStream: WriteStream,
        progressMessagePrefix: string
    ): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            request.on('response', (response) => {
                if (response.statusCode !== 200) {
                    reject(
                        new Error(`Failed with status ${response.statusCode}, ${response.statusMessage}, Uri ${uri}`)
                    );
                }
            });
            // tslint:disable-next-line: no-require-imports
            const requestProgress = require('request-progress');
            requestProgress(request)
                .on('progress', (state: RequestProgressState) => {
                    statusBarProgress.text = formatProgressMessageWithState(progressMessagePrefix, state);
                })
                // Handle errors from download.
                .on('error', reject)
                .pipe(fileStream)
                // Handle error in writing to fs.
                .on('error', reject)
                .on('close', resolve);
        });
    }
}

type RequestProgressState = {
    percent: number;
    speed: number;
    size: {
        total: number;
        transferred: number;
    };
    time: {
        elapsed: number;
        remaining: number;
    };
};

function formatProgressMessageWithState(progressMessagePrefix: string, state: RequestProgressState): string {
    const received = Math.round(state.size.transferred / 1024);
    const total = Math.round(state.size.total / 1024);
    const percentage = Math.round(100 * state.percent);

    return Http.downloadingFileProgress().format(
        progressMessagePrefix,
        received.toString(),
        total.toString(),
        percentage.toString()
    );
}
