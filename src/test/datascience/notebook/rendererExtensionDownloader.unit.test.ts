// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { IApplicationShell, ICommandManager } from '../../../client/common/application/types';
import { IFileDownloader, IOutputChannel } from '../../../client/common/types';
import { RendererExtensionDownloadUri } from '../../../client/datascience/notebook/constants';
import { RendererExtensionDownloader } from '../../../client/datascience/notebook/rendererExtensionDownloader';
import { IDataScienceFileSystem } from '../../../client/datascience/types';
import { noop } from '../../core';

// tslint:disable: no-any
suite('DataScience - NativeNotebook Download Renderer Extension', () => {
    let downloader: RendererExtensionDownloader;
    let appShell: IApplicationShell;
    let output: IOutputChannel;
    let fs: IDataScienceFileSystem;
    let fileDownloader: IFileDownloader;
    let cmdManager: ICommandManager;
    const downloadedFile = Uri.file('TempRendererExtensionVSIX.vsix');
    setup(() => {
        appShell = mock<IApplicationShell>();
        output = mock<IOutputChannel>();
        fs = mock<IDataScienceFileSystem>();
        fileDownloader = mock<IFileDownloader>();
        cmdManager = mock<ICommandManager>();
        downloader = new RendererExtensionDownloader(
            instance(output),
            instance(appShell),
            instance(cmdManager),
            instance(fileDownloader),
            instance(fs)
        );

        when(fileDownloader.downloadFile(anything(), anything())).thenResolve(downloadedFile.fsPath);
        when(appShell.withProgressCustomIcon(anything(), anything())).thenCall((_, cb) => cb({ report: noop }));
        when(cmdManager.executeCommand(anything(), anything())).thenResolve();
    });
    teardown(() => verify(fs.deleteLocalFile(downloadedFile.fsPath)).once());
    test('Should download & install extension', async () => {
        await downloader.downloadAndInstall();

        verify(fileDownloader.downloadFile(RendererExtensionDownloadUri, anything())).once();
        verify(cmdManager.executeCommand('workbench.extensions.installExtension', anything())).once();
        const fileArg = capture(cmdManager.executeCommand as any).first()[1] as Uri;
        assert.equal(fileArg.fsPath, downloadedFile.fsPath);
    });
    test('Should download & install extension once', async () => {
        await Promise.all([downloader.downloadAndInstall(), downloader.downloadAndInstall()]);
        await downloader.downloadAndInstall();
        await downloader.downloadAndInstall();

        verify(fileDownloader.downloadFile(RendererExtensionDownloadUri, anything())).once();
        verify(cmdManager.executeCommand('workbench.extensions.installExtension', anything())).once();
        const fileArg = capture(cmdManager.executeCommand as any).first()[1] as Uri;
        assert.equal(fileArg.fsPath, downloadedFile.fsPath);
    });
});
