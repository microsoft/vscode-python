// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { LanguageServerDownloader } from '../../client/activation/downloader';
import { PlatformData } from '../../client/activation/platformData';
import { ILanguageServerFolderService } from '../../client/activation/types';
import { STANDARD_OUTPUT_CHANNEL } from '../../client/common/constants';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IOutputChannel } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';

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
        const platformData: PlatformData = new PlatformData(platformService.object, fs.object);
        container.setup(a => a.get(TypeMoq.It.isValue(IOutputChannel), TypeMoq.It.isValue(STANDARD_OUTPUT_CHANNEL))).returns(() => output.object);
        container.setup(a => a.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fs.object);
        container.setup(a => a.get(TypeMoq.It.isValue(ILanguageServerFolderService))).returns(() => folderService.object);

        languageServerDownloader = new LanguageServerDownloader(platformData, '', container.object);
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
});
