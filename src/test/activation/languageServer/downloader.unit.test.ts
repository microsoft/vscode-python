// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { SemVer } from 'semver';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { Uri, WorkspaceConfiguration } from 'vscode';
import { LanguageServerDownloader } from '../../../client/activation/common/downloader';
import { DotNetLanguageServerFolderService } from '../../../client/activation/languageServer/languageServerFolderService';
import {
    ILanguageServerFolderService,
    ILanguageServerOutputChannel,
    IPlatformData,
} from '../../../client/activation/types';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { IApplicationShell, IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { FileDownloader } from '../../../client/common/net/fileDownloader';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../client/common/platform/types';
import { IFileDownloader, IOutputChannel, Resource } from '../../../client/common/types';
import { Common, LanguageService } from '../../../client/common/utils/localize';
import { noop } from '../../core';
import { MockOutputChannel } from '../../mockClasses';

use(chaiAsPromised);

suite('Language Server Activation - Downloader', () => {
    let languageServerDownloader: LanguageServerDownloader;
    let folderService: TypeMoq.IMock<ILanguageServerFolderService>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let resource: Resource;
    let outputChannel: IOutputChannel;
    let lsOutputChannel: TypeMoq.IMock<ILanguageServerOutputChannel>;
    setup(() => {
        outputChannel = mock(MockOutputChannel);
        lsOutputChannel = TypeMoq.Mock.ofType<ILanguageServerOutputChannel>();
        lsOutputChannel.setup((l) => l.channel).returns(() => instance(outputChannel));
        folderService = TypeMoq.Mock.ofType<ILanguageServerFolderService>(undefined, TypeMoq.MockBehavior.Strict);
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>(undefined, TypeMoq.MockBehavior.Strict);
        resource = Uri.file(__dirname);
        languageServerDownloader = new LanguageServerDownloader(
            lsOutputChannel.object,
            undefined as any,
            folderService.object,
            undefined as any,
            undefined as any,
            workspaceService.object,
            undefined as any,
        );
    });

    test('Get download info - HTTPS with resource', async () => {
        const cfg = TypeMoq.Mock.ofType<WorkspaceConfiguration>(undefined, TypeMoq.MockBehavior.Strict);
        cfg.setup((c) => c.get('proxyStrictSSL', true))
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        workspaceService
            .setup((w) => w.getConfiguration(TypeMoq.It.isValue('http'), TypeMoq.It.isValue(resource)))
            .returns(() => cfg.object)
            .verifiable(TypeMoq.Times.once());

        const pkg = makePkgInfo('ls', 'https://a.b.com/x/y/z/ls.nupkg');
        folderService
            .setup((f) => f.getLatestLanguageServerVersion(resource))
            .returns(() => Promise.resolve(pkg))
            .verifiable(TypeMoq.Times.once());

        const [uri, version, name] = await languageServerDownloader.getDownloadInfo(resource);

        folderService.verifyAll();
        workspaceService.verifyAll();
        expect(uri).to.equal(pkg.uri);
        expect(version).to.equal(pkg.version.raw);
        expect(name).to.equal('ls');
    });

    test('Get download info - HTTPS without resource', async () => {
        const cfg = TypeMoq.Mock.ofType<WorkspaceConfiguration>(undefined, TypeMoq.MockBehavior.Strict);
        cfg.setup((c) => c.get('proxyStrictSSL', true))
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        workspaceService
            .setup((w) => w.getConfiguration(TypeMoq.It.isValue('http'), undefined))
            .returns(() => cfg.object)
            .verifiable(TypeMoq.Times.once());

        const pkg = makePkgInfo('ls', 'https://a.b.com/x/y/z/ls.nupkg');
        folderService
            .setup((f) => f.getLatestLanguageServerVersion(undefined))
            .returns(() => Promise.resolve(pkg))
            .verifiable(TypeMoq.Times.once());

        const [uri, version, name] = await languageServerDownloader.getDownloadInfo(undefined);

        folderService.verifyAll();
        workspaceService.verifyAll();
        expect(uri).to.equal(pkg.uri);
        expect(version).to.equal(pkg.version.raw);
        expect(name).to.equal('ls');
    });

    test('Get download info - HTTPS disabled', async () => {
        const cfg = TypeMoq.Mock.ofType<WorkspaceConfiguration>(undefined, TypeMoq.MockBehavior.Strict);
        cfg.setup((c) => c.get('proxyStrictSSL', true))
            .returns(() => false)
            .verifiable(TypeMoq.Times.once());
        workspaceService
            .setup((w) => w.getConfiguration(TypeMoq.It.isValue('http'), TypeMoq.It.isValue(resource)))
            .returns(() => cfg.object)
            .verifiable(TypeMoq.Times.once());

        const pkg = makePkgInfo('ls', 'https://a.b.com/x/y/z/ls.nupkg');
        folderService
            .setup((f) => f.getLatestLanguageServerVersion(resource))
            .returns(() => Promise.resolve(pkg))
            .verifiable(TypeMoq.Times.once());

        const [uri, version, name] = await languageServerDownloader.getDownloadInfo(resource);

        folderService.verifyAll();
        workspaceService.verifyAll();

        expect(uri).to.deep.equal('http://a.b.com/x/y/z/ls.nupkg');
        expect(version).to.equal(pkg.version.raw);
        expect(name).to.equal('ls');
    });

    test('Get download info - HTTP', async () => {
        const pkg = makePkgInfo('ls', 'http://a.b.com/x/y/z/ls.nupkg');
        folderService
            .setup((f) => f.getLatestLanguageServerVersion(resource))
            .returns(() => Promise.resolve(pkg))
            .verifiable(TypeMoq.Times.once());

        const [uri, version, name] = await languageServerDownloader.getDownloadInfo(resource);

        folderService.verifyAll();
        workspaceService.verifyAll();
        expect(uri).to.equal(pkg.uri);
        expect(version).to.equal(pkg.version.raw);
        expect(name).to.equal('ls');
    });

    test('Get download info - bogus URL', async () => {
        const pkg = makePkgInfo('ls', 'xyz');
        folderService
            .setup((f) => f.getLatestLanguageServerVersion(resource))
            .returns(() => Promise.resolve(pkg))
            .verifiable(TypeMoq.Times.once());

        const [uri, version, name] = await languageServerDownloader.getDownloadInfo(resource);

        folderService.verifyAll();
        workspaceService.verifyAll();
        expect(uri).to.equal(pkg.uri);
        expect(version).to.equal(pkg.version.raw);
        expect(name).to.equal('ls');
    });

    suite('Test LanguageServerDownloader.downloadFile', () => {
        let lsDownloader: LanguageServerDownloader;
        let outputChannelDownload: IOutputChannel;
        let fileDownloader: IFileDownloader;
        let lsOutputChannelDownload: TypeMoq.IMock<ILanguageServerOutputChannel>;

        const downloadUri = 'http://wow.com/file.txt';
        const downloadTitle = 'Downloadimg file.txt';
        setup(() => {
            outputChannelDownload = mock(MockOutputChannel);
            fileDownloader = mock(FileDownloader);
            const lsFolderService = mock(DotNetLanguageServerFolderService);
            const appShell = mock(ApplicationShell);
            const fs = mock(FileSystem);

            const workspaceService = mock(WorkspaceService);
            lsOutputChannelDownload = TypeMoq.Mock.ofType<ILanguageServerOutputChannel>();
            lsOutputChannelDownload.setup((l) => l.channel).returns(() => instance(outputChannelDownload));

            lsDownloader = new LanguageServerDownloader(
                lsOutputChannelDownload.object,
                instance(fileDownloader),
                instance(lsFolderService),
                instance(appShell),
                instance(fs),
                instance(workspaceService),
                undefined as any,
            );
        });

        test('Downloaded file name must be returned from file downloader and right args passed', async () => {
            const downloadedFile = 'This is the downloaded file';
            when(fileDownloader.downloadFile(anything(), anything())).thenResolve(downloadedFile);
            const expectedDownloadOptions = {
                extension: '.nupkg',
                outputChannel: instance(outputChannelDownload),
                progressMessagePrefix: downloadTitle,
            };

            const file = await lsDownloader.downloadFile(downloadUri, downloadTitle);

            expect(file).to.be.equal(downloadedFile);
            verify(fileDownloader.downloadFile(anything(), anything())).once();
            verify(fileDownloader.downloadFile(downloadUri, deepEqual(expectedDownloadOptions))).once();
        });
        test('If download succeeds then log completion message', async () => {
            when(fileDownloader.downloadFile(anything(), anything())).thenResolve();

            await lsDownloader.downloadFile(downloadUri, downloadTitle);

            verify(fileDownloader.downloadFile(anything(), anything())).once();
            verify(outputChannelDownload.appendLine(LanguageService.extractionCompletedOutputMessage())).once();
        });
        test('If download fails do not log completion message', async () => {
            const ex = new Error('kaboom');
            when(fileDownloader.downloadFile(anything(), anything())).thenReject(ex);

            const promise = lsDownloader.downloadFile(downloadUri, downloadTitle);
            await promise.catch(noop);

            verify(outputChannelDownload.appendLine(LanguageService.extractionCompletedOutputMessage())).never();
            expect(promise).to.eventually.be.rejectedWith('kaboom');
        });
    });

    suite('Test LanguageServerDownloader.downloadLanguageServer', () => {
        const failure = new Error('kaboom');

        class LanguageServerDownloaderTest extends LanguageServerDownloader {
            public async downloadLanguageServer(destinationFolder: string, res?: Resource): Promise<void> {
                return super.downloadLanguageServer(destinationFolder, res);
            }
            public async downloadFile(_uri: string, _title: string): Promise<string> {
                throw failure;
            }
        }
        class LanguageServerExtractorTest extends LanguageServerDownloader {
            public async downloadLanguageServer(destinationFolder: string, res?: Resource): Promise<void> {
                return super.downloadLanguageServer(destinationFolder, res);
            }

            public async getDownloadInfo(res?: Resource) {
                return super.getDownloadInfo(res);
            }
            public async downloadFile() {
                return 'random';
            }
            protected async unpackArchive(_extensionPath: string, _tempFilePath: string): Promise<void> {
                throw failure;
            }
        }
        class LanguageServeBundledTest extends LanguageServerDownloader {
            public async downloadLanguageServer(destinationFolder: string, res?: Resource): Promise<void> {
                return super.downloadLanguageServer(destinationFolder, res);
            }

            public async getDownloadInfo(_res?: Resource): Promise<string[]> {
                throw failure;
            }
            public async downloadFile(): Promise<string> {
                throw failure;
            }
            protected async unpackArchive(_extensionPath: string, _tempFilePath: string): Promise<void> {
                throw failure;
            }
        }
        let output: TypeMoq.IMock<IOutputChannel>;
        let appShell: TypeMoq.IMock<IApplicationShell>;
        let fs: TypeMoq.IMock<IFileSystem>;
        let platformData: TypeMoq.IMock<IPlatformData>;
        let languageServerDownloaderTest: LanguageServerDownloaderTest;
        let languageServerExtractorTest: LanguageServerExtractorTest;
        let languageServerBundledTest: LanguageServeBundledTest;
        setup(() => {
            appShell = TypeMoq.Mock.ofType<IApplicationShell>(undefined, TypeMoq.MockBehavior.Strict);
            folderService = TypeMoq.Mock.ofType<ILanguageServerFolderService>(undefined, TypeMoq.MockBehavior.Strict);
            output = TypeMoq.Mock.ofType<IOutputChannel>();
            fs = TypeMoq.Mock.ofType<IFileSystem>(undefined, TypeMoq.MockBehavior.Strict);
            platformData = TypeMoq.Mock.ofType<IPlatformData>(undefined, TypeMoq.MockBehavior.Strict);
            lsOutputChannel = TypeMoq.Mock.ofType<ILanguageServerOutputChannel>();
            lsOutputChannel.setup((l) => l.channel).returns(() => output.object);

            languageServerDownloaderTest = new LanguageServerDownloaderTest(
                lsOutputChannel.object,
                undefined as any,
                folderService.object,
                appShell.object,
                fs.object,
                workspaceService.object,
                undefined as any,
            );
            languageServerExtractorTest = new LanguageServerExtractorTest(
                lsOutputChannel.object,
                undefined as any,
                folderService.object,
                appShell.object,
                fs.object,
                workspaceService.object,
                undefined as any,
            );
            languageServerBundledTest = new LanguageServeBundledTest(
                lsOutputChannel.object,
                undefined as any,
                folderService.object,
                appShell.object,
                fs.object,
                workspaceService.object,
                undefined as any,
            );
        });
        test('Display error message if LS downloading fails', async () => {
            folderService.setup((f) => f.skipDownload()).returns(async () => false);
            const pkg = makePkgInfo('ls', 'xyz');
            folderService.setup((f) => f.getLatestLanguageServerVersion(resource)).returns(() => Promise.resolve(pkg));
            output.setup((o) => o.appendLine(LanguageService.downloadFailedOutputMessage()));
            output.setup((o) => o.appendLine((failure as unknown) as string));
            appShell
                .setup((a) => a.showErrorMessage(LanguageService.lsFailedToDownload(), Common.openOutputPanel()))
                .returns(() => Promise.resolve(undefined));

            let actualFailure: Error | undefined;
            try {
                await languageServerDownloaderTest.downloadLanguageServer('', resource);
            } catch (err) {
                actualFailure = err;
            }

            expect(actualFailure).to.not.equal(undefined, 'error not thrown');
            folderService.verifyAll();
            output.verifyAll();
            appShell.verifyAll();
            fs.verifyAll();
            platformData.verifyAll();
        });
        test('Display error message if LS extraction fails', async () => {
            folderService.setup((f) => f.skipDownload()).returns(async () => false);
            const pkg = makePkgInfo('ls', 'xyz');
            folderService.setup((f) => f.getLatestLanguageServerVersion(resource)).returns(() => Promise.resolve(pkg));
            output.setup((o) => o.appendLine(LanguageService.extractionFailedOutputMessage()));
            output.setup((o) => o.appendLine((failure as unknown) as string));
            appShell
                .setup((a) => a.showErrorMessage(LanguageService.lsFailedToExtract(), Common.openOutputPanel()))
                .returns(() => Promise.resolve(undefined));

            let actualFailure: Error | undefined;
            try {
                await languageServerExtractorTest.downloadLanguageServer('', resource);
            } catch (err) {
                actualFailure = err;
            }

            expect(actualFailure).to.not.equal(undefined, 'error not thrown');
            folderService.verifyAll();
            output.verifyAll();
            appShell.verifyAll();
            fs.verifyAll();
            platformData.verifyAll();
        });
        test('No download if bundled', async () => {
            folderService.setup((f) => f.skipDownload()).returns(async () => true);

            await languageServerBundledTest.downloadLanguageServer('', resource);

            folderService.verifyAll();
            output.verifyAll();
            appShell.verifyAll();
            fs.verifyAll();
            platformData.verifyAll();
        });
    });
});

function makePkgInfo(name: string, uri: string, version: string = '0.0.0') {
    return {
        package: name,
        uri: uri,
        version: new SemVer(version),
    } as any;
}
