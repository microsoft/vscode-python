// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-unused-variable

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import { LanguageServerDownloader } from '../../client/activation/downloader';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IOutputChannel } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';

const downloadUriPrefix = 'https://pvsc.blob.core.windows.net/python-language-server';
const downloadBaseFileName = 'Python-Language-Server';
const downloadVersion = '0.1.0';
const downloadFileExtension = '.nupkg';

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
        assert.equal(link, `${downloadUriPrefix}/${downloadBaseFileName}-win-x86.${downloadVersion}${downloadFileExtension}`);
    });
    test('Windows 64Bit', async () => {
        setupPlatform({ windows: true, is64Bit: true });
        const link = await languageServerDownloader.getDownloadUri();
        assert.equal(link, `${downloadUriPrefix}/${downloadBaseFileName}-win-x64.${downloadVersion}${downloadFileExtension}`);
    });
    test('Mac 64Bit', async () => {
        setupPlatform({ mac: true, is64Bit: true });
        const link = await languageServerDownloader.getDownloadUri();
        assert.equal(link, `${downloadUriPrefix}/${downloadBaseFileName}-osx-x64.${downloadVersion}${downloadFileExtension}`);
    });
    test('Linux 64Bit', async () => {
        setupPlatform({ linux: true, is64Bit: true });
        const link = await languageServerDownloader.getDownloadUri();
        assert.equal(link, `${downloadUriPrefix}/${downloadBaseFileName}-linux-x64.${downloadVersion}${downloadFileExtension}`);
    });
});
