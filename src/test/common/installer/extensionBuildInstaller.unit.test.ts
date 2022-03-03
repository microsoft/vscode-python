// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

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
import * as logging from '../../../client/logging';

type ProgressReporterData = { message?: string; increment?: number };

suite('Extension build installer - Stable build installer', async () => {
    let cmdManager: ICommandManager;
    let appShell: IApplicationShell;
    let stableBuildInstaller: StableBuildInstaller;
    let progressReporter: Progress<ProgressReporterData>;
    let progressReportStub: sinon.SinonStub;
    let traceLogStub: sinon.SinonStub;
    setup(() => {
        cmdManager = mock(CommandManager);
        appShell = mock(ApplicationShell);
        stableBuildInstaller = new StableBuildInstaller(instance(cmdManager), instance(appShell));
        progressReportStub = sinon.stub();
        progressReporter = { report: progressReportStub };
        traceLogStub = sinon.stub(logging, 'traceLog');
    });
    teardown(() => {
        sinon.restore();
    });
    test('Installing stable build logs progress and installs stable', async () => {
        when(
            cmdManager.executeCommand('workbench.extensions.installExtension', PVSC_EXTENSION_ID, anything()),
        ).thenResolve(undefined);
        when(appShell.withProgressCustomIcon(anything(), anything())).thenCall((_, cb) => cb(progressReporter));
        await stableBuildInstaller.install();
        traceLogStub.calledWithExactly(ExtensionChannels.installingStableMessage());
        traceLogStub.calledWithExactly(ExtensionChannels.installationCompleteMessage());
        verify(appShell.withProgressCustomIcon(anything(), anything()));
        expect(progressReportStub.callCount).to.equal(1);
        verify(
            cmdManager.executeCommand('workbench.extensions.installExtension', PVSC_EXTENSION_ID, anything()),
        ).once();
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
    let traceLogStub: sinon.SinonStub;
    setup(() => {
        fileDownloader = mock(FileDownloader);
        fs = mock(FileSystem);
        cmdManager = mock(CommandManager);
        appShell = mock(ApplicationShell);
        progressReportStub = sinon.stub();
        progressReporter = { report: progressReportStub };
        insidersBuildInstaller = new InsidersBuildInstaller(
            instance(fileDownloader),
            instance(fs),
            instance(cmdManager),
            instance(appShell),
        );
        traceLogStub = sinon.stub(logging, 'traceLog');
    });
    teardown(() => {
        sinon.restore();
    });
    test('Installing Insiders build downloads and installs Insiders', async () => {
        const vsixFilePath = 'path/to/vsix';
        const options = {
            extension: vsixFileExtension,
            outputChannel: output,
            progressMessagePrefix: ExtensionChannels.downloadingInsidersMessage(),
        };
        when(fileDownloader.downloadFile(developmentBuildUri, anything())).thenCall(
            (_, downloadOptions: DownloadOptions) => {
                expect(downloadOptions.extension).to.equal(options.extension, 'Incorrect file extension');
                expect(downloadOptions.progressMessagePrefix).to.equal(options.progressMessagePrefix);
                return Promise.resolve(vsixFilePath);
            },
        );
        when(appShell.withProgressCustomIcon(anything(), anything())).thenCall((_, cb) => cb(progressReporter));
        when(cmdManager.executeCommand('workbench.extensions.installExtension', anything(), anything())).thenCall(
            (_, uri, options) => {
                assert.deepStrictEqual(uri, Uri.file(vsixFilePath), 'Wrong VSIX installed');
                assert.deepStrictEqual(options, { installOnlyNewlyAddedFromExtensionPackVSIX: true });
            },
        );
        when(fs.deleteFile(vsixFilePath)).thenResolve();

        await insidersBuildInstaller.install();

        traceLogStub.calledWithExactly(ExtensionChannels.installingInsidersMessage());
        traceLogStub.calledWithExactly(ExtensionChannels.startingDownloadOutputMessage());
        traceLogStub.calledWithExactly(ExtensionChannels.downloadCompletedOutputMessage());
        traceLogStub.calledWithExactly(ExtensionChannels.installationCompleteMessage());
        verify(appShell.withProgressCustomIcon(anything(), anything()));
        expect(progressReportStub.callCount).to.equal(1);
        verify(cmdManager.executeCommand('workbench.extensions.installExtension', anything(), anything())).once();
        verify(fs.deleteFile(vsixFilePath)).once();
    });
});
