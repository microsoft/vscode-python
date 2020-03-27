// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { ProgressLocation, window } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../common/application/types';
import '../../common/extensions';
import { IFileSystem } from '../../common/platform/types';
import { IFileDownloader, IOutputChannel, Resource } from '../../common/types';
import { createDeferred } from '../../common/utils/async';
import { Common, LanguageService } from '../../common/utils/localize';
import { StopWatch } from '../../common/utils/stopWatch';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import {
    ILanguageServerDownloader,
    ILanguageServerFolderService,
    ILanguageServerOutputChannel,
    IPlatformData
} from '../types';

// tslint:disable:no-require-imports no-any

const downloadFileExtension = '.nupkg';

@injectable()
export class LanguageServerDownloader implements ILanguageServerDownloader {
    private output: IOutputChannel;
    constructor(
        @inject(ILanguageServerOutputChannel) private readonly lsOutputChannel: ILanguageServerOutputChannel,
        @inject(IFileDownloader) private readonly fileDownloader: IFileDownloader,
        @inject(ILanguageServerFolderService) private readonly lsFolderService: ILanguageServerFolderService,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IServiceContainer) private readonly services: IServiceContainer
    ) {
        this.output = this.lsOutputChannel.channel;
    }

    public async getDownloadInfo(resource: Resource) {
        const info = await this.lsFolderService.getLatestLanguageServerVersion(resource).then((item) => item!);

        let uri = info.uri;
        if (uri.startsWith('https:')) {
            const cfg = this.workspace.getConfiguration('http', resource);
            if (!cfg.get<boolean>('proxyStrictSSL', true)) {
                // tslint:disable-next-line:no-http-string
                uri = uri.replace(/^https:/, 'http:');
            }
        }
        const lsNameTrimmed = info.package.split('.')[0];
        return [uri, info.version.raw, lsNameTrimmed];
    }

    public async downloadLanguageServer(destinationFolder: string, resource: Resource): Promise<void> {
        const [downloadUri, lsVersion, lsName] = await this.getDownloadInfo(resource);
        const timer: StopWatch = new StopWatch();
        let success: boolean = true;
        let localTempFilePath = '';

        try {
            localTempFilePath = await this.downloadFile(
                downloadUri,
                'Downloading Microsoft Python Language Server... '
            );
        } catch (err) {
            this.output.appendLine(LanguageService.downloadFailedOutputMessage());
            this.output.appendLine(err);
            success = false;
            this.showMessageAndOptionallyShowOutput(LanguageService.lsFailedToDownload()).ignoreErrors();
            sendTelemetryEvent(
                EventName.PYTHON_LANGUAGE_SERVER_ERROR,
                undefined,
                { error: 'Failed to download (platform)' },
                err
            );
            throw new Error(err);
        } finally {
            const usedSSL = downloadUri.startsWith('https:');
            sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_DOWNLOADED, timer.elapsedTime, {
                success,
                lsVersion,
                usedSSL,
                lsName
            });
        }

        timer.reset();
        try {
            await this.unpackArchive(destinationFolder, localTempFilePath);
        } catch (err) {
            this.output.appendLine(LanguageService.extractionFailedOutputMessage());
            this.output.appendLine(err);
            success = false;
            this.showMessageAndOptionallyShowOutput(LanguageService.lsFailedToExtract()).ignoreErrors();
            sendTelemetryEvent(
                EventName.PYTHON_LANGUAGE_SERVER_ERROR,
                undefined,
                { error: 'Failed to extract (platform)' },
                err
            );
            throw new Error(err);
        } finally {
            sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_EXTRACTED, timer.elapsedTime, {
                success,
                lsVersion,
                lsName
            });
            await this.fs.deleteFile(localTempFilePath);
        }
    }

    public async showMessageAndOptionallyShowOutput(message: string) {
        const selection = await this.appShell.showErrorMessage(message, Common.openOutputPanel());
        if (selection !== Common.openOutputPanel()) {
            return;
        }
        this.output.show(true);
    }

    public async downloadFile(uri: string, title: string): Promise<string> {
        const downloadOptions = {
            extension: downloadFileExtension,
            outputChannel: this.output,
            progressMessagePrefix: title
        };
        return this.fileDownloader.downloadFile(uri, downloadOptions).then((file) => {
            this.output.appendLine(LanguageService.extractionCompletedOutputMessage());
            return file;
        });
    }

    protected async unpackArchive(destinationFolder: string, tempFilePath: string): Promise<void> {
        this.output.append('Unpacking archive... ');

        const deferred = createDeferred();

        const title = 'Extracting files... ';
        await window.withProgress(
            {
                location: ProgressLocation.Window
            },
            (progress) => {
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
                    if (!(await this.fs.directoryExists(destinationFolder))) {
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
                })
                    .on('extract', () => {
                        extractedFiles += 1;
                        progress.report({ message: `${title}${Math.round((100 * extractedFiles) / totalFiles)}%` });
                    })
                    .on('error', (e: any) => {
                        deferred.reject(e);
                    });
                return deferred.promise;
            }
        );

        // Set file to executable (nothing happens in Windows, as chmod has no definition there)
        if (this.services) {
            try {
                const platformData = this.services.get<IPlatformData>(IPlatformData);
                const executablePath = path.join(destinationFolder, platformData.engineExecutableName);
                await this.fs.chmod(executablePath, '0764'); // -rwxrw-r--
                // tslint:disable-next-line: no-empty
            } catch {}
        }

        this.output.appendLine(LanguageService.extractionDoneOutputMessage());
    }
}
