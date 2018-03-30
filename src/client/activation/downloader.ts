// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs';
import * as path from 'path';
import * as request from 'request';
import * as requestProgress from 'request-progress';
import * as unzip from 'unzip';
import { ExtensionContext, OutputChannel, ProgressLocation, window } from 'vscode';
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { noop } from '../common/core.utils';
import { createDeferred, createTemporaryFile } from '../common/helpers';
import { IPlatformService } from '../common/platform/types';
import { IOutputChannel } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { HashVerifier } from './hashVerifier';
import { PlatformData } from './platformData';

const downloadUriPrefix = 'https://pvsc.blob.core.windows.net/python-analysis';
const downloadBaseFileName = 'python-analysis-vscode';
const downloadVersion = '0.1.0';
const downloadFileExtension = '.nupkg';

export class AnalysisEngineDownloader {
    private readonly output: OutputChannel;
    private readonly platform: IPlatformService;
    private readonly platformData: PlatformData;

    constructor(private readonly services: IServiceContainer, private engineFolder: string) {
        this.output = this.services.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.platform = this.services.get<IPlatformService>(IPlatformService);
        this.platformData = new PlatformData(this.platform);
    }

    public async downloadAnalysisEngine(context: ExtensionContext): Promise<void> {
        const localTempFilePath = await this.downloadFile();
        try {
            await this.verifyDownload(localTempFilePath);
            await this.unpackArchive(context.extensionPath, localTempFilePath);
        } catch (err) {
            this.output.appendLine('failed.');
            this.output.appendLine(err);
            throw new Error(err);
        } finally {
            fs.unlink(localTempFilePath, noop);
        }
    }

    private async downloadFile(): Promise<string> {
        const platformString = this.platformData.getPlatformDesignator();
        const remoteFileName = `${downloadBaseFileName}-${platformString}.${downloadVersion}${downloadFileExtension}`;
        const uri = `${downloadUriPrefix}/${remoteFileName}`;
        this.output.append(`Downloading ${uri}... `);
        const tempFile = await createTemporaryFile(downloadFileExtension);

        const deferred = createDeferred();
        const fileStream = fs.createWriteStream(tempFile.filePath);
        fileStream.on('finish', () => {
            fileStream.close();
        }).on('error', (err) => {
            tempFile.cleanupCallback();
            deferred.reject(err);
        });

        const title = 'Downloading Python Analysis Engine... ';
        await window.withProgress({
            location: ProgressLocation.Window,
            title
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

    private async verifyDownload(filePath: string): Promise<void> {
        this.output.appendLine('');
        this.output.append('Verifying download... ');
        const verifier = new HashVerifier();
        if (!await verifier.verifyHash(filePath, this.platformData.getExpectedHash())) {
            throw new Error('Hash of the downloaded file does not match.');
        }
        this.output.append('valid.');
    }

    private async unpackArchive(extensionPath: string, tempFilePath: string): Promise<void> {
        this.output.appendLine('');
        this.output.append('Unpacking archive... ');

        const installFolder = path.join(extensionPath, this.engineFolder);
        const deferred = createDeferred();

        fs.createReadStream(tempFilePath)
            .pipe(unzip.Extract({ path: installFolder }))
            .on('finish', () => {
                deferred.resolve();
            })
            .on('error', (err) => {
                deferred.reject(err);
            });
        await deferred.promise;
        this.output.append('done.');

        // Set file to executable
        if (!this.platform.isWindows) {
            const executablePath = path.join(installFolder, this.platformData.getEngineExecutableName());
            fs.chmodSync(executablePath, '0764'); // -rwxrw-r--
        }
    }
}
