// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs';
import { IncomingMessage } from 'http';
import * as https from 'https';
import * as path from 'path';
import * as unzip from 'unzip';
import { ExtensionContext, OutputChannel } from 'vscode';
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
    private readonly platformData: PlatformData;

    constructor(private readonly services: IServiceContainer, private engineFolder: string) {
        this.output = this.services.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        const platform = this.services.get<IPlatformService>(IPlatformService);
        this.platformData = new PlatformData(platform);
    }

    public async downloadAnalysisEngine(context: ExtensionContext): Promise<void> {
        const localTempFilePath = await this.downloadFile();
        try {
            await this.verifyDownload(localTempFilePath);
            await this.unpackArchive(context.extensionPath, localTempFilePath);
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
            deferred.resolve();
        }).on('error', (err) => {
            tempFile.cleanupCallback();
            this.handleError(`Unable to download Python Analysis Engine. Error ${err}`);
        });

        let firstResponse = true;
        https.get(uri, (response) => {
            this.checkHttpResponse(response);
            if (firstResponse) {
                this.reportDownloadSize(response);
                firstResponse = false;
            }
            response.pipe(fileStream);
        });

        await deferred.promise;
        this.output.append('complete.');
        return tempFile.filePath;
    }

    private async verifyDownload(filePath: string): Promise<void> {
        this.output.appendLine('');
        this.output.append('Verifying download... ');
        const verifier = new HashVerifier();
        if (!await verifier.verifyHash(filePath, this.platformData.getExpectedHash())) {
            this.handleError('Hash of the downloaded file does not match.');
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
                this.handleError(`Unable to unpack downloaded file. Error ${err}.`);
            });
        await deferred.promise;
        this.output.append('done.');
    }

    private handleError(message: string) {
        this.output.appendLine('failed.');
        this.output.appendLine(message);
        throw new Error(message);
    }

    private checkHttpResponse(response: IncomingMessage): boolean {
        if (response.statusCode && response.statusCode !== 0 && response.statusCode !== 200) {
            this.handleError(`HTTPS request failed: ${response.statusCode} : ${(response.statusMessage ? response.statusMessage : '')}`);
            return false;
        }
        return true;
    }

    private reportDownloadSize(response: IncomingMessage): number {
        if (response.rawHeaders.length >= 2 && response.rawHeaders[0] === 'Content-Length') {
            const size = parseInt(response.rawHeaders[1], 10);
            if (size > 0) {
                this.output.append(` ${Math.round(size / 1024)} KB...`);
            }
        }
        return 0;
    }
}
