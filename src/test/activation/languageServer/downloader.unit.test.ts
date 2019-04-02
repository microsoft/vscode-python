// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { LanguageServerDownloader } from '../../../client/activation/languageServer/downloader';
import { ILanguageServerFolderService, IPlatformData } from '../../../client/activation/types';
import { IApplicationShell, IWorkspaceService } from '../../../client/common/application/types';
import { IFileSystem } from '../../../client/common/platform/types';
import { IOutputChannel } from '../../../client/common/types';
import { Common, LanguageService } from '../../../client/common/utils/localize';

// tslint:disable-next-line:max-func-body-length
suite('Activation - Downloader', () => {
    let languageServerDownloader: LanguageServerDownloader;
    let folderService: TypeMoq.IMock<ILanguageServerFolderService>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    setup(() => {
        folderService = TypeMoq.Mock.ofType<ILanguageServerFolderService>(undefined, TypeMoq.MockBehavior.Strict);
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>(undefined, TypeMoq.MockBehavior.Strict);
        languageServerDownloader = new LanguageServerDownloader(
            undefined as any,
            undefined as any,
            undefined as any,
            folderService.object,
            undefined as any,
            undefined as any,
            workspaceService.object
        );
    });

    test('Get download info - HTTPS', async () => {
        const pkg = {
            uri: 'https://a.b.com/x/y/z.nupkg',
            version: { raw: '1.2.3' }
        } as any;
        folderService
            .setup(f => f.getLatestLanguageServerVersion())
            .returns(() => Promise.resolve(pkg))
            .verifiable(TypeMoq.Times.once());

        const [uri, version] = await languageServerDownloader.getDownloadInfo();

        folderService.verifyAll();
        workspaceService.verifyAll();
        expect(uri).to.deep.equal(pkg.uri);
        expect(version).to.deep.equal(pkg.version.raw);
    });

    test('Get download info - HTTP', async () => {
        const pkg = {
            // tslint:disable-next-line:no-http-string
            uri: 'http://a.b.com/x/y/z.nupkg',
            version: { raw: '1.2.3' }
        } as any;
        folderService
            .setup(f => f.getLatestLanguageServerVersion())
            .returns(() => Promise.resolve(pkg))
            .verifiable(TypeMoq.Times.once());

        const [uri, version] = await languageServerDownloader.getDownloadInfo();

        folderService.verifyAll();
        workspaceService.verifyAll();
        expect(uri).to.deep.equal(pkg.uri);
        expect(version).to.deep.equal(pkg.version.raw);
    });

    test('Get download info - bogus URL', async () => {
        const pkg = {
            uri: 'xyz',
            version: { raw: '1.2.3' }
        } as any;
        folderService
            .setup(f => f.getLatestLanguageServerVersion())
            .returns(() => Promise.resolve(pkg))
            .verifiable(TypeMoq.Times.once());

        const [uri, version] = await languageServerDownloader.getDownloadInfo();

        folderService.verifyAll();
        workspaceService.verifyAll();
        expect(uri).to.deep.equal(pkg.uri);
        expect(version).to.deep.equal(pkg.version.raw);
    });

    // tslint:disable-next-line:max-func-body-length
    suite('Test LanguageServerDownloader.downloadLanguageServer', () => {
        const failure = new Error('kaboom');

        class LanguageServerDownloaderTest extends LanguageServerDownloader {
            // tslint:disable-next-line:no-unnecessary-override
            public async downloadLanguageServer(destinationFolder: string): Promise<void> {
                return super.downloadLanguageServer(destinationFolder);
            }
            protected async downloadFile(_uri: string, _title: string): Promise<string> {
                throw failure;
            }
        }
        class LanguageServerExtractorTest extends LanguageServerDownloader {
            // tslint:disable-next-line:no-unnecessary-override
            public async downloadLanguageServer(destinationFolder: string): Promise<void> {
                return super.downloadLanguageServer(destinationFolder);
            }
            // tslint:disable-next-line:no-unnecessary-override
            public async getDownloadInfo() {
                return super.getDownloadInfo();
            }
            protected async downloadFile() {
                return 'random';
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
        setup(() => {
            appShell = TypeMoq.Mock.ofType<IApplicationShell>(undefined, TypeMoq.MockBehavior.Strict);
            folderService = TypeMoq.Mock.ofType<ILanguageServerFolderService>(undefined, TypeMoq.MockBehavior.Strict);
            output = TypeMoq.Mock.ofType<IOutputChannel>(undefined, TypeMoq.MockBehavior.Strict);
            fs = TypeMoq.Mock.ofType<IFileSystem>(undefined, TypeMoq.MockBehavior.Strict);
            platformData = TypeMoq.Mock.ofType<IPlatformData>(undefined, TypeMoq.MockBehavior.Strict);

            languageServerDownloaderTest = new LanguageServerDownloaderTest(
                platformData.object,
                output.object,
                undefined as any,
                folderService.object,
                appShell.object,
                fs.object,
                workspaceService.object
            );
            languageServerExtractorTest = new LanguageServerExtractorTest(
                platformData.object,
                output.object,
                undefined as any,
                folderService.object,
                appShell.object,
                fs.object,
                workspaceService.object
            );
        });
        test('Display error message if LS downloading fails', async () => {
            const pkg = { uri: 'xyz', package: 'abc', version: new SemVer('0.0.0') } as any;
            folderService
                .setup(f => f.getLatestLanguageServerVersion())
                .returns(() => Promise.resolve(pkg))
                .verifiable(TypeMoq.Times.once());
            output.setup(o => o.appendLine(LanguageService.downloadFailedOutputMessage()))
                .verifiable(TypeMoq.Times.once());
            output.setup(o => o.appendLine((failure as unknown) as string))
                .verifiable(TypeMoq.Times.once());
            appShell.setup(a => a.showErrorMessage(LanguageService.lsFailedToDownload(), Common.openOutputPanel()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            try {
                await languageServerDownloaderTest.downloadLanguageServer('');
            } catch (err) {
                output.verifyAll();
                appShell.verifyAll();
            }
            folderService.verifyAll();
            fs.verifyAll();
            platformData.verifyAll();
        });
        test('Display error message if LS extraction fails', async () => {
            const pkg = { uri: 'xyz', package: 'abc', version: new SemVer('0.0.0') } as any;
            folderService
                .setup(f => f.getLatestLanguageServerVersion())
                .returns(() => Promise.resolve(pkg))
                .verifiable(TypeMoq.Times.once());
            output.setup(o => o.appendLine(LanguageService.extractionFailedOutputMessage()))
                .verifiable(TypeMoq.Times.once());
            output.setup(o => o.appendLine((failure as unknown) as string))
                .verifiable(TypeMoq.Times.once());
            appShell.setup(a => a.showErrorMessage(LanguageService.lsFailedToExtract(), Common.openOutputPanel()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            try {
                await languageServerExtractorTest.downloadLanguageServer('');
            } catch (err) {
                appShell.verifyAll();
            }
            folderService.verifyAll();
            fs.verifyAll();
            platformData.verifyAll();
        });
    });
});
