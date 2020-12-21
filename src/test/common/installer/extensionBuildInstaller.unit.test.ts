// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length no-invalid-this

import * as assert from 'assert';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Progress, Uri } from 'vscode';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { CommandManager } from '../../../client/common/application/commandManager';
import { IApplicationShell, ICommandManager } from '../../../client/common/application/types';
import { PVSC_EXTENSION_ID } from '../../../client/common/constants';
import {
    developmentBuildUri,
    InsidersBuildInstaller,
    StableBuildInstaller,
    vsixFileExtension,
} from '../../../client/common/installer/extensionBuildInstaller';
import { FileDownloader } from '../../../client/common/net/fileDownloader';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../client/common/platform/types';
import { DownloadOptions, IFileDownloader, IOutputChannel } from '../../../client/common/types';
import { ExtensionChannels } from '../../../client/common/utils/localize';
import { MockOutputChannel } from '../../../test/mockClasses';

type ProgressReporterData = { message?: string; increment?: number };

suite('Extension build installer - Stable build installer', async () => {
    let output: IOutputChannel;
    let cmdManager: ICommandManager;
    let appShell: IApplicationShell;
    let stableBuildInstaller: StableBuildInstaller;
    let progressReporter: Progress<ProgressReporterData>;
    let progressReportStub: sinon.SinonStub;
    setup(() => {
        output = mock(MockOutputChannel);
        cmdManager = mock(CommandManager);
        appShell = mock(ApplicationShell);
        stableBuildInstaller = new StableBuildInstaller(instance(output), instance(cmdManager), instance(appShell));
        progressReportStub = sinon.stub();
        progressReporter = { report: progressReportStub };
    });
    test('Installing stable build logs progress and installs stable', async () => {
        when(output.append(ExtensionChannels.installingStableMessage())).thenReturn();
        when(output.appendLine(ExtensionChannels.installationCompleteMessage())).thenReturn();
        when(cmdManager.executeCommand('workbench.extensions.installExtension', PVSC_EXTENSION_ID)).thenResolve(
            undefined,
        );
        when(appShell.withProgressCustomIcon(anything(), anything())).thenCall((_, cb) => cb(progressReporter));
        await stableBuildInstaller.install();
        verify(output.append(ExtensionChannels.installingStableMessage())).once();
        verify(output.appendLine(ExtensionChannels.installationCompleteMessage())).once();
        verify(appShell.withProgressCustomIcon(anything(), anything()));
        expect(progressReportStub.callCount).to.equal(1);
        verify(cmdManager.executeCommand('workbench.extensions.installExtension', PVSC_EXTENSION_ID)).once();
    });
});

suite('Extension build installer - Insiders build installer', async () => {
    let output: IOutputChannel;
    let cmdManager: ICommandManager;
    let fileDownloader: IFileDownloader;
    let fs: IFileSystem;
    let appShell: IApplicationShell;
    let insidersBuildInstaller: InsidersBuildInstaller;
    let progressReporter: Progress<ProgressReporterData>;
    let progressReportStub: sinon.SinonStub;
    setup(() => {
        output = mock(MockOutputChannel);
        fileDownloader = mock(FileDownloader);
        fs = mock(FileSystem);
        cmdManager = mock(CommandManager);
        appShell = mock(ApplicationShell);
        progressReportStub = sinon.stub();
        progressReporter = { report: progressReportStub };
        insidersBuildInstaller = new InsidersBuildInstaller(
            instance(output),
            instance(fileDownloader),
            instance(fs),
            instance(cmdManager),
            instance(appShell),
        );
    });
    test('Installing Insiders build downloads and installs Insiders', async () => {
        const vsixFilePath = 'path/to/vsix';
        const options = {
            extension: vsixFileExtension,
            outputChannel: output,
            progressMessagePrefix: ExtensionChannels.downloadingInsidersMessage(),
        };
        when(output.append(ExtensionChannels.installingInsidersMessage())).thenReturn();
        when(output.appendLine(ExtensionChannels.startingDownloadOutputMessage())).thenReturn();
        when(output.appendLine(ExtensionChannels.downloadCompletedOutputMessage())).thenReturn();
        when(output.appendLine(ExtensionChannels.installationCompleteMessage())).thenReturn();
        when(fileDownloader.downloadFile(developmentBuildUri, anything())).thenCall(
            (_, downloadOptions: DownloadOptions) => {
                expect(downloadOptions.extension).to.equal(options.extension, 'Incorrect file extension');
                expect(downloadOptions.progressMessagePrefix).to.equal(options.progressMessagePrefix);
                return Promise.resolve(vsixFilePath);
            },
        );
        when(appShell.withProgressCustomIcon(anything(), anything())).thenCall((_, cb) => cb(progressReporter));
        when(cmdManager.executeCommand('workbench.extensions.installExtension', anything())).thenCall((_, cb) => {
            assert.deepEqual(cb, Uri.file(vsixFilePath), 'Wrong VSIX installed');
        });
        when(fs.deleteFile(vsixFilePath)).thenResolve();

        await insidersBuildInstaller.install();

        verify(output.append(ExtensionChannels.installingInsidersMessage())).once();
        verify(output.appendLine(ExtensionChannels.startingDownloadOutputMessage())).once();
        verify(output.appendLine(ExtensionChannels.downloadCompletedOutputMessage())).once();
        verify(output.appendLine(ExtensionChannels.installationCompleteMessage())).once();
        verify(appShell.withProgressCustomIcon(anything(), anything()));
        expect(progressReportStub.callCount).to.equal(1);
        verify(cmdManager.executeCommand('workbench.extensions.installExtension', anything())).once();
        verify(fs.deleteFile(vsixFilePath)).once();
    });
});
