// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as TypeMoq from 'typemoq';
import { LanguageServerDownloader } from '../../client/activation/downloader';
import { ILanguageServerFolderService, ILanguageServerPlatformData } from '../../client/activation/types';
import { IApplicationShell } from '../../client/common/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../../client/common/constants';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IExtensionContext, IOutputChannel } from '../../client/common/types';
import { LanguageService } from '../../client/common/utils/localize';
import { IServiceContainer } from '../../client/ioc/types';

// tslint:disable-next-line:max-func-body-length
suite('Activation - Downloader', () => {
    let languageServerDownloader: LanguageServerDownloader;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let container: TypeMoq.IMock<IServiceContainer>;
    let folderService: TypeMoq.IMock<ILanguageServerFolderService>;
    setup(() => {
        container = TypeMoq.Mock.ofType<IServiceContainer>();
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        folderService = TypeMoq.Mock.ofType<ILanguageServerFolderService>();
        const fs = TypeMoq.Mock.ofType<IFileSystem>();
        const output = TypeMoq.Mock.ofType<IOutputChannel>();
        const platformData = TypeMoq.Mock.ofType<ILanguageServerPlatformData>();
        container.setup(a => a.get(TypeMoq.It.isValue(IOutputChannel), TypeMoq.It.isValue(STANDARD_OUTPUT_CHANNEL))).returns(() => output.object);
        container.setup(a => a.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fs.object);
        container.setup(a => a.get(TypeMoq.It.isValue(ILanguageServerFolderService))).returns(() => folderService.object);

        languageServerDownloader = new LanguageServerDownloader(platformData.object, '', container.object);
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
            public async downloadLanguageServer(context: IExtensionContext): Promise<void> {
                return super.downloadLanguageServer(context);
            }
            protected async downloadFile(_uri: string, _title: string): Promise<string> {
                throw new Error('kaboom');
            }
        }
        class LanguageServerExtractorTest extends LanguageServerDownloader {
            // tslint:disable-next-line:no-unnecessary-override
            public async downloadLanguageServer(context: IExtensionContext): Promise<void> {
                return super.downloadLanguageServer(context);
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
            container = TypeMoq.Mock.ofType<IServiceContainer>();
            platformService = TypeMoq.Mock.ofType<IPlatformService>();
            folderService = TypeMoq.Mock.ofType<ILanguageServerFolderService>();
            const fs = TypeMoq.Mock.ofType<IFileSystem>();
            const output = TypeMoq.Mock.ofType<IOutputChannel>();
            const platformData = TypeMoq.Mock.ofType<ILanguageServerPlatformData>();
            container.setup(a => a.get(TypeMoq.It.isValue(IOutputChannel), TypeMoq.It.isValue(STANDARD_OUTPUT_CHANNEL))).returns(() => output.object);
            container.setup(a => a.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fs.object);
            container.setup(a => a.get(TypeMoq.It.isValue(ILanguageServerFolderService))).returns(() => folderService.object);
            container.setup(c => c.get(TypeMoq.It.isValue(IApplicationShell))).returns(() => appShell.object);

            languageServerDownloaderTest = new LanguageServerDownloaderTest(platformData.object, '', container.object);
            languageServerExtractorTest = new LanguageServerExtractorTest(platformData.object, '', container.object);
        });
        test('Display error message if LS downloading fails', async () => {
            const context = TypeMoq.Mock.ofType<IExtensionContext>();
            const pkg = { uri: 'xyz', package: 'abc', version: new SemVer('0.0.0') } as any;
            folderService
                .setup(f => f.getLatestLanguageServerVersion())
                .returns(() => Promise.resolve(pkg))
                .verifiable(TypeMoq.Times.once());
            appShell.setup(a => a.showErrorMessage(LanguageService.lsFailedToDownload()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            try {
                await languageServerDownloaderTest.downloadLanguageServer(context.object);
            } catch (err) {
                appShell.verifyAll();
            }
            folderService.verifyAll();
        });
        test('Display error message if LS extraction fails', async () => {
            const context = TypeMoq.Mock.ofType<IExtensionContext>();
            const pkg = { uri: 'xyz', package: 'abc', version: new SemVer('0.0.0') } as any;
            folderService
                .setup(f => f.getLatestLanguageServerVersion())
                .returns(() => Promise.resolve(pkg))
                .verifiable(TypeMoq.Times.once());
            appShell.setup(a => a.showErrorMessage(LanguageService.lsFailedToExtract()))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            try {
                await languageServerExtractorTest.downloadLanguageServer(context.object);
            } catch (err) {
                appShell.verifyAll();
            }
            folderService.verifyAll();
        });
    });
});
