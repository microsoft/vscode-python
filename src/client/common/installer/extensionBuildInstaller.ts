// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Uri } from 'vscode';
import { ICommandManager } from '../application/types';
import { PVSC_EXTENSION_ID, STANDARD_OUTPUT_CHANNEL } from '../constants';
import { traceDecorators } from '../logger';
import { IFileSystem } from '../platform/types';
import { IFileDownloader, IOutputChannel } from '../types';
import { ExtensionChannels } from '../utils/localize';
import { IExtensionBuildInstaller } from './types';

export const developmentBuildUri = 'https://pvsc.blob.core.windows.net/extension-builds/ms-python-insiders.vsix';
export const vsixFileExtension = '.vsix';

@injectable()
export class StableBuildInstaller implements IExtensionBuildInstaller {
    constructor(
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly output: IOutputChannel,
        @inject(ICommandManager) private readonly cmdManager: ICommandManager
    ) {}

    @traceDecorators.error('Installing stable build of extension failed')
    public async install(): Promise<void> {
        this.output.append(ExtensionChannels.installingStableMessage());
        await this.cmdManager.executeCommand('workbench.extensions.installExtension', PVSC_EXTENSION_ID);
        this.output.appendLine(ExtensionChannels.installationCompleteMessage());
    }
}

@injectable()
export class InsidersBuildInstaller implements IExtensionBuildInstaller {
    constructor(
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly output: IOutputChannel,
        @inject(IFileDownloader) private readonly fileDownloader: IFileDownloader,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(ICommandManager) private readonly cmdManager: ICommandManager
    ) {}

    @traceDecorators.error('Installing insiders build of extension failed')
    public async install(): Promise<void> {
        const vsixFilePath = await this.downloadInsiders();
        this.output.append(ExtensionChannels.installingInsidersMessage());
        await this.cmdManager.executeCommand('workbench.extensions.installExtension', Uri.file(vsixFilePath));
        this.output.appendLine(ExtensionChannels.installationCompleteMessage());
        await this.fs.deleteFile(vsixFilePath);
    }

    @traceDecorators.error('Downloading insiders build of extension failed')
    public async downloadInsiders(): Promise<string> {
        this.output.appendLine(ExtensionChannels.startingDownloadOutputMessage());
        const downloadOptions = {
            extension: vsixFileExtension,
            outputChannel: this.output,
            progressMessagePrefix: ExtensionChannels.downloadingInsidersMessage()
        };
        return this.fileDownloader.downloadFile(developmentBuildUri, downloadOptions).then((file) => {
            this.output.appendLine(ExtensionChannels.downloadCompletedOutputMessage());
            return file;
        });
    }
}
