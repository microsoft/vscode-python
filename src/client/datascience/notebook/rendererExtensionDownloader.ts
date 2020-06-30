// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { Uri } from 'vscode';
import { IApplicationShell, ICommandManager } from '../../common/application/types';
import { Octicons, STANDARD_OUTPUT_CHANNEL } from '../../common/constants';
import { vsixFileExtension } from '../../common/installer/extensionBuildInstaller';
import { IFileSystem } from '../../common/platform/types';
import { IFileDownloader, IOutputChannel } from '../../common/types';
import { DataScienceRendererExtension } from '../../common/utils/localize';
import { traceDecorators } from '../../logging';
import { RendererExtensionDownloadUri } from './constants';

@injectable()
export class RendererExtensionDownloader {
    private installed?: boolean;
    constructor(
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly output: IOutputChannel,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(ICommandManager) private readonly cmdManager: ICommandManager,
        @inject(IFileDownloader) private readonly fileDownloader: IFileDownloader,
        @inject(IFileSystem) private readonly fs: IFileSystem
    ) {}
    @traceDecorators.error('Installing Notebook Renderer extension failed')
    public async downloadAndInstall(): Promise<void> {
        if (this.installed) {
            return;
        }
        this.installed = true;
        const vsixFilePath = await this.download();
        try {
            this.output.append(DataScienceRendererExtension.installingExtension());
            await this.appShell.withProgressCustomIcon(Octicons.Installing, async (progress) => {
                progress.report({ message: DataScienceRendererExtension.installingExtension() });
                return this.cmdManager.executeCommand('workbench.extensions.installExtension', Uri.file(vsixFilePath));
            });
            this.output.appendLine(DataScienceRendererExtension.installationCompleteMessage());
        } finally {
            await this.fs.deleteFile(vsixFilePath);
        }
    }

    @traceDecorators.error('Downloading Notebook Renderer extension failed')
    private async download(): Promise<string> {
        this.output.appendLine(DataScienceRendererExtension.startingDownloadOutputMessage());
        const downloadOptions = {
            extension: vsixFileExtension,
            outputChannel: this.output,
            progressMessagePrefix: DataScienceRendererExtension.downloadingMessage()
        };
        return this.fileDownloader.downloadFile(RendererExtensionDownloadUri, downloadOptions).then((file) => {
            this.output.appendLine(DataScienceRendererExtension.downloadCompletedOutputMessage());
            return file;
        });
    }
}
