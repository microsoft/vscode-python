// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fileSystem from 'fs';
import * as path from 'path';
import * as request from 'request';
import * as requestProgress from 'request-progress';
import { ExtensionContext, OutputChannel, ProgressLocation, window } from 'vscode';
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { createDeferred, createTemporaryFile } from '../common/helpers';
import { IFileSystem, IPlatformService } from '../common/platform/types';
import { IOutputChannel } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { HashVerifier } from './hashVerifier';
import { PlatformData } from './platformData';

// tslint:disable-next-line:no-require-imports no-var-requires
const StreamZip = require('node-stream-zip');

const downloadUriPrefix = 'https://pvsc.blob.core.windows.net/python-analysis';
const downloadBaseFileName = 'python-analysis-vscode';
const downloadVersion = '0.1.0';
const downloadFileExtension = '.nupkg';
const pythiaModelName = 'model-sequence.json.gz';

export class AnalysisEngineDownloader {
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

    public async downloadAnalysisEngine(context: ExtensionContext): Promise<void> {
        const platformString = await this.platformData.getPlatformName();
        const enginePackageFileName = `${downloadBaseFileName}-${platformString}.${downloadVersion}${downloadFileExtension}`;

        let localTempFilePath = '';
        try {
            localTempFilePath = await this.downloadFile(downloadUriPrefix, enginePackageFileName, 'Downloading Python Analysis Engine... ');
            await this.verifyDownload(localTempFilePath, platformString);
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

    public async downloadPythiaModel(context: ExtensionContext): Promise<void> {
        const modelFolder = path.join(context.extensionPath, 'analysis', 'Pythia', 'model');
        const localPath = path.join(modelFolder, pythiaModelName);
        if (await this.fs.fileExists(localPath)) {
            return;
        }

        let localTempFilePath = '';
        try {
            localTempFilePath = await this.downloadFile(downloadUriPrefix, pythiaModelName, 'Downloading IntelliSense Model File... ');
            await this.fs.createDirectory(modelFolder);
            await this.fs.copyFile(localTempFilePath, localPath);
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

    private async downloadFile(location: string, fileName: string, title: string): Promise<string> {
        const uri = `${location}/${fileName}`;
        this.output.append(`Downloading ${uri}... `);
        const tempFile = await createTemporaryFile(downloadFileExtension);

        const deferred = createDeferred();
        const fileStream = fileSystem.createWriteStream(tempFile.filePath);
        fileStream.on('finish', () => {
            fileStream.close();
        }).on('error', (err) => {
            tempFile.cleanupCallback();
            deferred.reject(err);
        });

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

    private async verifyDownload(filePath: string, platformString: string): Promise<void> {
        this.output.appendLine('');
        this.output.append('Verifying download... ');
        const verifier = new HashVerifier();
        if (!await verifier.verifyHash(filePath, platformString, await this.platformData.getExpectedHash())) {
            throw new Error('Hash of the downloaded file does not match.');
        }
        this.output.append('valid.');
    }

    private async unpackArchive(extensionPath: string, tempFilePath: string): Promise<void> {
        this.output.appendLine('');
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
            });
            return deferred.promise;
        });
        this.output.append('done.');

        // Set file to executable
        if (!this.platform.isWindows) {
            const executablePath = path.join(installFolder, this.platformData.getEngineExecutableName());
            fileSystem.chmodSync(executablePath, '0764'); // -rwxrw-r--
        }
    }
}
