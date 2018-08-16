// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-unused-variable

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import { WorkspaceConfiguration } from 'vscode';
import { DownloadLinks, LanguageServerDownloader } from '../../client/activation/downloader';
import { PlatformData, PlatformName } from '../../client/activation/platformData';
import { IWorkspaceService } from '../../client/common/application/types';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IOutputChannel } from '../../client/common/types';

suite('Activation - Downloader', () => {
    let languageServerDownloader: LanguageServerDownloader;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let proxyValue: string = '';

    setup(() => {
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        const fs = TypeMoq.Mock.ofType<IFileSystem>();
        const output = TypeMoq.Mock.ofType<IOutputChannel>();
        const workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        const platformData: PlatformData = new PlatformData(platformService.object, fs.object);
        const wsConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        workspace.setup(a => a.getConfiguration(TypeMoq.It.isValue('http'))).returns(() => wsConfig.object);
        wsConfig.setup(a => a.get(TypeMoq.It.isValue('proxy'))).returns(() => proxyValue);

        languageServerDownloader = new LanguageServerDownloader(
            output.object,
            fs.object,
            platformData,
            workspace.object,
            ''
        );

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
    test('Download via proxy', async () => {
        setupPlatform({ linux: true, is64Bit: true });
        proxyValue = 'https://dereksproxy:3333';
        const link = await languageServerDownloader.getDownloadUri();
    });
});
