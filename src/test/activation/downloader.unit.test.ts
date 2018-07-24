// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-unused-variable

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import { DownloadLinks, LanguageServerDownloader } from '../../client/activation/downloader';
import { PlatformName } from '../../client/activation/platformData';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IOutputChannel } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';

suite('Activation - Downloader', () => {
    let languageServerDownloader: LanguageServerDownloader;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        const fs = TypeMoq.Mock.ofType<IFileSystem>();
        const output = TypeMoq.Mock.ofType<IOutputChannel>();

        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IOutputChannel), TypeMoq.It.isAny())).returns(() => output.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPlatformService))).returns(() => platformService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fs.object);

        languageServerDownloader = new LanguageServerDownloader(serviceContainer.object, '');
    });
    type PlatformIdentifier = {
        windows?: boolean;
        mac?: boolean;
        linux?: boolean;
        is64Bit?: boolean;
    };
    function setupPlatform(platform: PlatformIdentifier) {
        platformService.setup(x => x.isWindows).returns(() => platform.windows === true);
        platformService.setup(x => x.isMac).returns(() => platform.mac === true);
        platformService.setup(x => x.isLinux).returns(() => platform.linux === true);
        platformService.setup(x => x.is64bit).returns(() => platform.is64Bit === true);
    }
    test('Windows 32Bit', async () => {
        setupPlatform({ windows: true });
        const link = await languageServerDownloader.getDownloadUri();
        assert.equal(link, DownloadLinks[PlatformName.Windows32Bit]);
    });
    test('Windows 64Bit', async () => {
        setupPlatform({ windows: true, is64Bit: true });
        const link = await languageServerDownloader.getDownloadUri();
        assert.equal(link, DownloadLinks[PlatformName.Windows64Bit]);
    });
    test('Mac 64Bit', async () => {
        setupPlatform({ mac: true, is64Bit: true });
        const link = await languageServerDownloader.getDownloadUri();
        assert.equal(link, DownloadLinks[PlatformName.Mac64Bit]);
    });
    test('Linux 64Bit', async () => {
        setupPlatform({ linux: true, is64Bit: true });
        const link = await languageServerDownloader.getDownloadUri();
        assert.equal(link, DownloadLinks[PlatformName.Linux64Bit]);
    });
});
