// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fileSystem from 'fs';
import * as path from 'path';
import * as request from 'request';
import * as requestProgress from 'request-progress';
import { OutputChannel, ProgressLocation, window } from 'vscode';
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { createDeferred } from '../common/helpers';
import { IFileSystem, IPlatformService } from '../common/platform/types';
import { IExtensionContext, IOutputChannel } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { PlatformData, PlatformName } from './platformData';

// tslint:disable-next-line:no-require-imports no-var-requires
const StreamZip = require('node-stream-zip');

const downloadUriPrefix = 'https://pvsc.blob.core.windows.net/python-language-server';
const downloadBaseFileName = 'Python-Language-Server';
const downloadVersion = 'beta';
const downloadFileExtension = '.nupkg';

export const DownloadLinks = {
    [PlatformName.Windows32Bit]: `${downloadUriPrefix}/${downloadBaseFileName}-${PlatformName.Windows32Bit}.${downloadVersion}${downloadFileExtension}`,
    [PlatformName.Windows64Bit]: `${downloadUriPrefix}/${downloadBaseFileName}-${PlatformName.Windows64Bit}.${downloadVersion}${downloadFileExtension}`,
    [PlatformName.Linux64Bit]: `${downloadUriPrefix}/${downloadBaseFileName}-${PlatformName.Linux64Bit}.${downloadVersion}${downloadFileExtension}`,
    [PlatformName.Mac64Bit]: `${downloadUriPrefix}/${downloadBaseFileName}-${PlatformName.Mac64Bit}.${downloadVersion}${downloadFileExtension}`
};

export class LanguageServerDownloader {
    private readonly output: OutputChannel;
    private readonly platform: IPlatformService;
    private readonly platformData: PlatformData;
    private readonly fs: IFileSystem;

    constructor(private readonly services: IServiceContainer, private engineFolder: string) {
        this.output = this.services.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.fs = this.services.get<IFileSystem>(IFileSystem);
        this.platform = this.services.get<IPlatformService>(IPlatformService);
        this.platformData = new PlatformData(this.platform, this.fs);
    }

    public async getDownloadUri() {
        const platformString = await this.platformData.getPlatformName();
        return DownloadLinks[platformString];
    }

    public async downloadLanguageServer(context: IExtensionContext): Promise<void> {
        const downloadUri = await this.getDownloadUri();

        let localTempFilePath = '';
        try {
            localTempFilePath = await this.downloadFile(downloadUri, 'Downloading Microsoft Python Language Server... ');
            await this.unpackArchive(context.extensionPath, localTempFilePath);
        } catch (err) {
            this.output.appendLine('failed.');
            this.output.appendLine(err);
            throw new Error(err);
        } finally {
            if (localTempFilePath.length > 0) {
                await this.fs.deleteFile(localTempFilePath);
            }
        }
    }

    private async downloadFile(uri: string, title: string): Promise<string> {
        this.output.append(`Downloading ${uri}... `);
        const tempFile = await this.fs.createTemporaryFile(downloadFileExtension);

        const deferred = createDeferred();
        const fileStream = fileSystem.createWriteStream(tempFile.filePath);
        fileStream.on('finish', () => {
            fileStream.close();
        }).on('error', (err) => {
            tempFile.dispose();
            deferred.reject(err);
        });

        await window.withProgress({
            location: ProgressLocation.Window
        }, (progress) => {

            requestProgress(request(uri))
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
                zip.extract(null, installFolder, (err, count) => {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        deferred.resolve();
                    }
                    zip.close();
                });
            }).on('extract', (entry, file) => {
                extractedFiles += 1;
                progress.report({ message: `${title}${Math.round(100 * extractedFiles / totalFiles)}%` });
            }).on('error', e => {
                deferred.reject(e);
            });
            return deferred.promise;
        });

        // Set file to executable
        if (!this.platform.isWindows) {
            const executablePath = path.join(installFolder, this.platformData.getEngineExecutableName());
            fileSystem.chmodSync(executablePath, '0764'); // -rwxrw-r--
        }
        this.output.appendLine('done.');
    }
}
