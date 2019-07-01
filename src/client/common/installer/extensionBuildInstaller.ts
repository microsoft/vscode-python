// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Uri } from 'vscode';
import { ICommandManager } from '../application/types';
import { PVSC_EXTENSION_ID, STANDARD_OUTPUT_CHANNEL } from '../constants';
import { IFileSystem } from '../platform/types';
import { IFileDownloader, IOutputChannel } from '../types';
import { Insiders } from '../utils/localize';
import { IBuildInstaller } from './types';

const developmentBuildUri = 'https://pvsc.blob.core.windows.net/extension-builds/ms-python-insiders.vsix';
const vsixFileExtension = '.vsix';

@injectable()
export class StableBuildInstaller implements IBuildInstaller {
    constructor(@inject(ICommandManager) private readonly cmdManager: ICommandManager) { }
    public async install(): Promise<void> {
        await this.cmdManager.executeCommand('workbench.extensions.installExtension', PVSC_EXTENSION_ID);
    }
}

@injectable()
export class InsidersBuildInstaller implements IBuildInstaller {
    constructor(
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly output: IOutputChannel,
        @inject(IFileDownloader) private readonly fileDownloader: IFileDownloader,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(ICommandManager) private readonly cmdManager: ICommandManager) { }
    public async install(): Promise<void> {
        const vsixFilePath = await this.downloadInsiders();
        await this.cmdManager.executeCommand('workbench.extensions.installExtension', Uri.file(vsixFilePath));
        await this.fs.deleteFile(vsixFilePath);
    }
    public async downloadInsiders(): Promise<string> {
        this.output.appendLine(Insiders.startingDownloadOutputMessage());
        const downloadOptions = {
            extension: vsixFileExtension,
            outputChannel: this.output,
            progressMessagePrefix: Insiders.downloadingInsidersMessage()
        };
        return this.fileDownloader.downloadFile(developmentBuildUri, downloadOptions).then(file => {
            this.output.appendLine(Insiders.downloadCompletedOutputMessage());
            return file;
        });
    }
}
