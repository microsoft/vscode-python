// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { ProgressLocation, window } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../common/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../../common/constants';
import '../../common/extensions';
import { IFileSystem } from '../../common/platform/types';
import { IOutputChannel, Resource } from '../../common/types';
import { createDeferred } from '../../common/utils/async';
import { Common, LanguageService } from '../../common/utils/localize';
import { StopWatch } from '../../common/utils/stopWatch';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import {
    IHttpClient, ILanguageServerDownloader, ILanguageServerFolderService,
    IPlatformData
} from '../types';

// tslint:disable:no-require-imports no-any

const downloadFileExtension = '.nupkg';

@injectable()
export class LanguageServerDownloader implements ILanguageServerDownloader {
    constructor(
        @inject(IPlatformData) private readonly platformData: IPlatformData,
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly output: IOutputChannel,
        @inject(IHttpClient) private readonly httpClient: IHttpClient,
        @inject(ILanguageServerFolderService) private readonly lsFolderService: ILanguageServerFolderService,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService
    ) {
    }

    public async getDownloadInfo(resource: Resource) {
        const info = await this.lsFolderService.getLatestLanguageServerVersion(resource)
            .then(item => item!);

        let uri = info.uri;
        if (uri.startsWith('https:')) {
            const cfg = this.workspace.getConfiguration('http', resource);
            if (!cfg.get<boolean>('proxyStrictSSL', true)) {
                // tslint:disable-next-line:no-http-string
                uri = uri.replace(/^https:/, 'http:');
            }
        }

        return [uri, info.version.raw];
    }
    public async downloadLanguageServer(destinationFolder: string, resource: Resource): Promise<void> {
        const [downloadUri, lsVersion] = await this.getDownloadInfo(resource);
        const timer: StopWatch = new StopWatch();
        let success: boolean = true;
        let localTempFilePath = '';

        try {
            localTempFilePath = await this.downloadFile(downloadUri, 'Downloading Microsoft Python Language Server... ');
        } catch (err) {
            this.output.appendLine(LanguageService.downloadFailedOutputMessage());
            this.output.appendLine(err);
            success = false;
            this.showMessageAndOptionallyShowOutput(LanguageService.lsFailedToDownload())
                .ignoreErrors();
            sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_ERROR, undefined, { error: 'Failed to download (platform)' }, err);
            throw new Error(err);
        } finally {
            const usedSSL = downloadUri.startsWith('https:');
            sendTelemetryEvent(
                EventName.PYTHON_LANGUAGE_SERVER_DOWNLOADED,
                timer.elapsedTime,
                { success, lsVersion, usedSSL }
            );
        }

        timer.reset();
        try {
            await this.unpackArchive(destinationFolder, localTempFilePath);
        } catch (err) {
            this.output.appendLine(LanguageService.extractionFailedOutputMessage());
            this.output.appendLine(err);
            success = false;
            this.showMessageAndOptionallyShowOutput(LanguageService.lsFailedToExtract())
                .ignoreErrors();
            sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_ERROR, undefined, { error: 'Failed to extract (platform)' }, err);
            throw new Error(err);
        } finally {
            sendTelemetryEvent(
                EventName.PYTHON_LANGUAGE_SERVER_EXTRACTED,
                timer.elapsedTime,
                { success, lsVersion }
            );
            await this.fs.deleteFile(localTempFilePath);
        }
    }

    protected async showMessageAndOptionallyShowOutput(message: string) {
        const selection = await this.appShell.showErrorMessage(message, Common.openOutputPanel());
        if (selection !== Common.openOutputPanel()) {
            return;
        }
        this.output.show(true);
    }
    protected async downloadFile(uri: string, title: string): Promise<string> {
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
        }, async (progress) => {
            const req = await this.httpClient.downloadFile(uri);
            req.on('response', (response) => {
                if (response.statusCode !== 200) {
                    const error = new Error(`Failed with status ${response.statusCode}, ${response.statusMessage}, Uri ${uri}`);
                    deferred.reject(error);
                    throw error;
                }
            });
            const requestProgress = require('request-progress');
            requestProgress(req)
                .on('progress', (state: any) => {
                    // https://www.npmjs.com/package/request-progress
                    const received = Math.round(state.size.transferred / 1024);
                    const total = Math.round(state.size.total / 1024);
                    const percentage = Math.round(100 * state.percent);
                    progress.report({
                        message: `${title}${received} of ${total} KB (${percentage}%)`
                    });
                })
                .on('error', (err: any) => {
                    deferred.reject(err);
                })
                .on('end', () => {
                    this.output.appendLine(LanguageService.extractionCompletedOutputMessage());
                    deferred.resolve();
                })
                .pipe(fileStream);
            return deferred.promise;
        });

        return tempFile.filePath;
    }

    protected async unpackArchive(destinationFolder: string, tempFilePath: string): Promise<void> {
        this.output.append('Unpacking archive... ');

        const deferred = createDeferred();

        const title = 'Extracting files... ';
        await window.withProgress({
            location: ProgressLocation.Window
        }, (progress) => {
            // tslint:disable-next-line:no-require-imports no-var-requires
            const StreamZip = require('node-stream-zip');
            const zip = new StreamZip({
                file: tempFilePath,
                storeEntries: true
            });

            let totalFiles = 0;
            let extractedFiles = 0;
            zip.on('ready', async () => {
                totalFiles = zip.entriesCount;
                if (!await this.fs.directoryExists(destinationFolder)) {
                    await this.fs.createDirectory(destinationFolder);
                }
                zip.extract(null, destinationFolder, (err: any) => {
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
            }).on('error', (e: any) => {
                deferred.reject(e);
            });
            return deferred.promise;
        });

        // Set file to executable (nothing happens in Windows, as chmod has no definition there)
        const executablePath = path.join(destinationFolder, this.platformData.engineExecutableName);
        await this.fs.chmod(executablePath, '0764'); // -rwxrw-r--

        this.output.appendLine(LanguageService.extractionDoneOutputMessage());
    }
}
