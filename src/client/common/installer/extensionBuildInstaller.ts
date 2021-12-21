// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { traceDecoratorError, traceLog } from '../../logging';
import { IApplicationShell, ICommandManager } from '../application/types';
import { Octicons, PVSC_EXTENSION_ID } from '../constants';
import { IFileSystem } from '../platform/types';
import { IFileDownloader } from '../types';
import { ExtensionChannels } from '../utils/localize';
import { IExtensionBuildInstaller } from './types';

export const developmentBuildUri = 'https://pvsc.blob.core.windows.net/extension-builds/ms-python-insiders.vsix';
export const vsixFileExtension = '.vsix';

@injectable()
export class StableBuildInstaller implements IExtensionBuildInstaller {
    constructor(
        @inject(ICommandManager) private readonly cmdManager: ICommandManager,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
    ) {}

    @traceDecoratorError('Installing stable build of extension failed')
    public async install(): Promise<void> {
        traceLog(ExtensionChannels.installingStableMessage());
        await this.appShell.withProgressCustomIcon(Octicons.Installing, async (progress) => {
            progress.report({ message: ExtensionChannels.installingStableMessage() });
            return this.cmdManager.executeCommand('workbench.extensions.installExtension', PVSC_EXTENSION_ID, {
                installOnlyNewlyAddedFromExtensionPackVSIX: true,
            });
        });
        traceLog(ExtensionChannels.installationCompleteMessage());
    }
}

@injectable()
export class InsidersBuildInstaller implements IExtensionBuildInstaller {
    constructor(
        @inject(IFileDownloader) private readonly fileDownloader: IFileDownloader,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(ICommandManager) private readonly cmdManager: ICommandManager,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
    ) {}

    @traceDecoratorError('Installing insiders build of extension failed')
    public async install(): Promise<void> {
        const vsixFilePath = await this.downloadInsiders();
        traceLog(ExtensionChannels.installingInsidersMessage());
        await this.appShell.withProgressCustomIcon(Octicons.Installing, async (progress) => {
            progress.report({ message: ExtensionChannels.installingInsidersMessage() });
            return this.cmdManager.executeCommand('workbench.extensions.installExtension', Uri.file(vsixFilePath), {
                installOnlyNewlyAddedFromExtensionPackVSIX: true,
            });
        });
        traceLog(ExtensionChannels.installationCompleteMessage());
        await this.fs.deleteFile(vsixFilePath);
    }

    @traceDecoratorError('Downloading insiders build of extension failed')
    public async downloadInsiders(): Promise<string> {
        traceLog(ExtensionChannels.startingDownloadOutputMessage());
        const downloadOptions = {
            extension: vsixFileExtension,
            progressMessagePrefix: ExtensionChannels.downloadingInsidersMessage(),
        };
        return this.fileDownloader.downloadFile(developmentBuildUri, downloadOptions).then((file) => {
            traceLog(ExtensionChannels.downloadCompletedOutputMessage());
            return file;
        });
    }
}
