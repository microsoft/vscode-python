// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Uri } from 'vscode';
import { traceDecoratorError } from '../../logging';
import { IApplicationShell, ICommandManager } from '../application/types';
import { Octicons, PVSC_EXTENSION_ID, STANDARD_OUTPUT_CHANNEL } from '../constants';
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
        @inject(ICommandManager) private readonly cmdManager: ICommandManager,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
    ) {}

    @traceDecoratorError('Installing stable build of extension failed')
    public async install(): Promise<void> {
        this.output.append(ExtensionChannels.installingStableMessage());
        await this.appShell.withProgressCustomIcon(Octicons.Installing, async (progress) => {
            progress.report({ message: ExtensionChannels.installingStableMessage() });
            return this.cmdManager.executeCommand('workbench.extensions.installExtension', PVSC_EXTENSION_ID, {
                installOnlyNewlyAddedFromExtensionPackVSIX: true,
            });
        });
        this.output.appendLine(ExtensionChannels.installationCompleteMessage());
    }
}

@injectable()
export class InsidersBuildInstaller implements IExtensionBuildInstaller {
    constructor(
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly output: IOutputChannel,
        @inject(IFileDownloader) private readonly fileDownloader: IFileDownloader,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(ICommandManager) private readonly cmdManager: ICommandManager,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
    ) {}

    @traceDecoratorError('Installing insiders build of extension failed')
    public async install(): Promise<void> {
        const vsixFilePath = await this.downloadInsiders();
        this.output.append(ExtensionChannels.installingInsidersMessage());
        await this.appShell.withProgressCustomIcon(Octicons.Installing, async (progress) => {
            progress.report({ message: ExtensionChannels.installingInsidersMessage() });
            return this.cmdManager.executeCommand('workbench.extensions.installExtension', Uri.file(vsixFilePath), {
                installOnlyNewlyAddedFromExtensionPackVSIX: true,
            });
        });
        this.output.appendLine(ExtensionChannels.installationCompleteMessage());
        await this.fs.deleteFile(vsixFilePath);
    }

    @traceDecoratorError('Downloading insiders build of extension failed')
    public async downloadInsiders(): Promise<string> {
        this.output.appendLine(ExtensionChannels.startingDownloadOutputMessage());
        const downloadOptions = {
            extension: vsixFileExtension,
            outputChannel: this.output,
            progressMessagePrefix: ExtensionChannels.downloadingInsidersMessage(),
        };
        return this.fileDownloader.downloadFile(developmentBuildUri, downloadOptions).then((file) => {
            this.output.appendLine(ExtensionChannels.downloadCompletedOutputMessage());
            return file;
        });
    }
}
