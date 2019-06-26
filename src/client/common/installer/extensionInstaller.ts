// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Uri } from 'vscode';
import { ICommandManager } from '../application/types';
import { PVSC_EXTENSION_ID, STANDARD_OUTPUT_CHANNEL } from '../constants';
import { IFileDownloader, IOutputChannel } from '../types';
import { LanguageService } from '../utils/localize';

const developmentBuildUri = 'https://pvsc.blob.core.windows.net/extension-builds/ms-python-insiders.vsix';
const vsixFileExtension = '.vsix';

@injectable()
export class ExtensionInstaller {
    constructor(
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly output: IOutputChannel,
        @inject(IFileDownloader) private readonly fileDownloader: IFileDownloader,
        @inject(ICommandManager) private readonly cmdManager: ICommandManager) { }
    public async installUsingVSIX(pathToVSIX: string): Promise<void> {
        await this.cmdManager.executeCommand('workbench.extensions.installExtension', Uri.file(pathToVSIX));
    }
    public async installStable(): Promise<void> {
        await this.cmdManager.executeCommand('workbench.extensions.installExtension', PVSC_EXTENSION_ID);
    }
    public async downloadInsiders(): Promise<string> {
        const downloadOptions = {
            extension: vsixFileExtension,
            outputChannel: this.output,
            progressMessagePrefix: 'Downloading Insiders Extension... '
        };
        return this.fileDownloader.downloadFile(developmentBuildUri, downloadOptions).then(file => {
            this.output.appendLine(LanguageService.extractionCompletedOutputMessage());
            return file;
        });
    }
}
