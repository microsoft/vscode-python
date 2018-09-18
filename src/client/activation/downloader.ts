// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as requestProgress from 'request-progress';
import { ProgressLocation, window } from 'vscode';
import { createDeferred } from '../../utils/async';
import { StopWatch } from '../../utils/stopWatch';
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { IFileSystem } from '../common/platform/types';
import { IExtensionContext, IOutputChannel } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { sendTelemetryEvent } from '../telemetry';
import {
    PYTHON_LANGUAGE_SERVER_DOWNLOADED,
    PYTHON_LANGUAGE_SERVER_EXTRACTED
} from '../telemetry/constants';
import { PlatformData } from './platformData';
import { IHttpClient, ILanguageServerDownloader, ILanguageServerFolderService } from './types';

// tslint:disable-next-line:no-require-imports no-var-requires
const StreamZip = require('node-stream-zip');
const downloadFileExtension = '.nupkg';

export class LanguageServerDownloader implements ILanguageServerDownloader {
    private readonly output: IOutputChannel;
    private readonly fs: IFileSystem;
    constructor(
        private readonly platformData: PlatformData,
        private readonly engineFolder: string,
        private readonly serviceContainer: IServiceContainer
    ) {
        this.output = this.serviceContainer.get<IOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.fs = this.serviceContainer.get<IFileSystem>(IFileSystem);

    }

    public async getDownloadUri() {
        const lsFolderService = this.serviceContainer.get<ILanguageServerFolderService>(ILanguageServerFolderService);
        return lsFolderService.getLatestLanguageServerVersion().then(info => info!.uri);
    }

    public async downloadLanguageServer(context: IExtensionContext): Promise<void> {
        const downloadUri = await this.getDownloadUri();
        const timer: StopWatch = new StopWatch();
        let success: boolean = true;
        let localTempFilePath = '';

        try {
            localTempFilePath = await this.downloadFile(downloadUri, 'Downloading Microsoft Python Language Server... ');
        } catch (err) {
            this.output.appendLine('download failed.');
            this.output.appendLine(err);
            success = false;
            throw new Error(err);
        } finally {
            sendTelemetryEvent(
                PYTHON_LANGUAGE_SERVER_DOWNLOADED,
                timer.elapsedTime,
                { success }
            );
        }

        timer.reset();
        try {
            await this.unpackArchive(context.extensionPath, localTempFilePath);
        } catch (err) {
            this.output.appendLine('extraction failed.');
            this.output.appendLine(err);
            success = false;
            throw new Error(err);
        } finally {
            sendTelemetryEvent(
                PYTHON_LANGUAGE_SERVER_EXTRACTED,
                timer.elapsedTime,
                { success }
            );
            await this.fs.deleteFile(localTempFilePath);
        }
    }

    private async downloadFile(uri: string, title: string): Promise<string> {
        this.output.append(`Downloading ${uri}... `);
        const tempFile = await this.fs.createTemporaryFile(downloadFileExtension);

        const deferred = createDeferred();
        const fileStream = this.fs.createWriteStream(tempFile.filePath);
        fileStream.on('finish', () => {
            fileStream.close();
        }).on('error', (err) => {
            tempFile.dispose();
            deferred.reject(err);
        });

        await window.withProgress({
            location: ProgressLocation.Window
        }, (progress) => {
            const httpClient = this.serviceContainer.get<IHttpClient>(IHttpClient);
            requestProgress(httpClient.downloadFile(uri))
                .on('progress', (state) => {
                    // https://www.npmjs.com/package/request-progress
                    const received = Math.round(state.size.transferred / 1024);
                    const total = Math.round(state.size.total / 1024);
                    const percentage = Math.round(100 * state.percent);
                    progress.report({
                        message: `${title}${received} of ${total} KB (${percentage}%)`
                    });
                })
                .on('error', (err) => {
                    deferred.reject(err);
                })
                .on('end', () => {
                    this.output.append('complete.');
                    deferred.resolve();
                })
                .pipe(fileStream);
            return deferred.promise;
        });

        return tempFile.filePath;
    }

    private async unpackArchive(extensionPath: string, tempFilePath: string): Promise<void> {
        this.output.append('Unpacking archive... ');

        const installFolder = path.join(extensionPath, this.engineFolder);
        const deferred = createDeferred();

        const title = 'Extracting files... ';
        await window.withProgress({
            location: ProgressLocation.Window,
            title
        }, (progress) => {
            const zip = new StreamZip({
                file: tempFilePath,
                storeEntries: true
            });

            let totalFiles = 0;
            let extractedFiles = 0;
            zip.on('ready', async () => {
                totalFiles = zip.entriesCount;
                if (!await this.fs.directoryExists(installFolder)) {
                    await this.fs.createDirectory(installFolder);
                }
                zip.extract(null, installFolder, (err) => {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        deferred.resolve();
                    }
                    zip.close();
                });
            }).on('extract', () => {
                extractedFiles += 1;
                progress.report({ message: `${title}${Math.round(100 * extractedFiles / totalFiles)}%` });
            }).on('error', e => {
                deferred.reject(e);
            });
            return deferred.promise;
        });

        // Set file to executable (nothing happens in Windows, as chmod has no definition there)
        const executablePath = path.join(installFolder, this.platformData.getEngineExecutableName());
        await this.fs.chmod(executablePath, '0764'); // -rwxrw-r--

        this.output.appendLine('done.');
    }
}
