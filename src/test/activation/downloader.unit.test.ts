// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { LanguageServerDownloader } from '../../client/activation/downloader';
import { ILanguageServerFolderService, IPlatformData } from '../../client/activation/types';
import { IApplicationShell } from '../../client/common/application/types';
import { IFileSystem } from '../../client/common/platform/types';
import { IOutputChannel } from '../../client/common/types';
import { LanguageService } from '../../client/common/utils/localize';

// tslint:disable-next-line:max-func-body-length
suite('Activation - Downloader', () => {
    let languageServerDownloader: LanguageServerDownloader;
    let folderService: TypeMoq.IMock<ILanguageServerFolderService>;
    setup(() => {
        folderService = TypeMoq.Mock.ofType<ILanguageServerFolderService>();
        languageServerDownloader = new LanguageServerDownloader(undefined as any,
            undefined as any, undefined as any,
            folderService.object, undefined as any,
            undefined as any);
    });

    test('Get download uri', async () => {
        const pkg = { uri: 'xyz' } as any;
        folderService
            .setup(f => f.getLatestLanguageServerVersion())
            .returns(() => Promise.resolve(pkg))
            .verifiable(TypeMoq.Times.once());

        const info = await languageServerDownloader.getDownloadInfo();

        folderService.verifyAll();
        expect(info).to.deep.equal(pkg);
    });
    suite('Test LanguageServerDownloader.downloadLanguageServer', () => {
        class LanguageServerDownloaderTest extends LanguageServerDownloader {
            // tslint:disable-next-line:no-unnecessary-override
            public async downloadLanguageServer(destinationFolder: string): Promise<void> {
                return super.downloadLanguageServer(destinationFolder);
            }
            protected async downloadFile(_uri: string, _title: string): Promise<string> {
                throw new Error('kaboom');
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
                throw new Error('kaboom');
            }
        }
        let appShell: TypeMoq.IMock<IApplicationShell>;
        let languageServerDownloaderTest: LanguageServerDownloaderTest;
        let languageServerExtractorTest: LanguageServerExtractorTest;
        setup(() => {
            appShell = TypeMoq.Mock.ofType<IApplicationShell>();
            folderService = TypeMoq.Mock.ofType<ILanguageServerFolderService>();
            const fs = TypeMoq.Mock.ofType<IFileSystem>();
            const output = TypeMoq.Mock.ofType<IOutputChannel>();
            const platformData = TypeMoq.Mock.ofType<IPlatformData>();

            languageServerDownloaderTest = new LanguageServerDownloaderTest(platformData.object,  output.object, undefined as any, folderService.object, appShell.object, fs.object);
            languageServerExtractorTest = new LanguageServerExtractorTest(platformData.object,  output.object, undefined as any, folderService.object, appShell.object, fs.object);
        });
        test('Display error message if LS downloading fails', async () => {
            const pkg = { uri: 'xyz', package: 'abc', version: new SemVer('0.0.0') } as any;
            folderService
                .setup(f => f.getLatestLanguageServerVersion())
                .returns(() => Promise.resolve(pkg))
                .verifiable(TypeMoq.Times.once());
            appShell.setup(a => a.showErrorMessage(LanguageService.lsFailedToDownload()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            try {
                await languageServerDownloaderTest.downloadLanguageServer('');
            } catch (err) {
                appShell.verifyAll();
            }
            folderService.verifyAll();
        });
        test('Display error message if LS extraction fails', async () => {
            const pkg = { uri: 'xyz', package: 'abc', version: new SemVer('0.0.0') } as any;
            folderService
                .setup(f => f.getLatestLanguageServerVersion())
                .returns(() => Promise.resolve(pkg))
                .verifiable(TypeMoq.Times.once());
            appShell.setup(a => a.showErrorMessage(LanguageService.lsFailedToExtract()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            try {
                await languageServerExtractorTest.downloadLanguageServer('');
            } catch (err) {
                appShell.verifyAll();
            }
            folderService.verifyAll();
        });
    });
});
