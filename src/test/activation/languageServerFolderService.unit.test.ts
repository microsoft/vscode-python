// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length

import { expect } from 'chai';
import * as path from 'path';
import { parse, SemVer } from 'semver';
import * as typeMoq from 'typemoq';
import { LanguageServerFolderService } from '../../client/activation/languageServerFolderService';
import { ILanguageServerPackageService } from '../../client/activation/types';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { NugetPackage } from '../../client/common/nuget/types';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IConfigurationService, IPythonSettings } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';

const languageServerFolder = 'languageServer';

suite('Language Server Folder Service', () => {
    let serviceContainer: typeMoq.IMock<IServiceContainer>;
    let platform: typeMoq.IMock<IPlatformService>;
    let lsFolderService: LanguageServerFolderService;
    let settings: typeMoq.IMock<IPythonSettings>;
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        platform = typeMoq.Mock.ofType<IPlatformService>();
        const configService = typeMoq.Mock.ofType<IConfigurationService>();
        settings = typeMoq.Mock.ofType<IPythonSettings>();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IPlatformService))).returns(() => platform.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IConfigurationService))).returns(() => configService.object);
        configService.setup(cfg => cfg.getSettings()).returns(() => settings.object);

        lsFolderService = new LanguageServerFolderService(serviceContainer.object);
    });
    test('Get latest language server version', async () => {
        const lsPackageService = typeMoq.Mock.ofType<ILanguageServerPackageService>();
        const pkgInfo = { package: 'string', version: new SemVer('1.1.1'), uri: 'uri' };
        lsPackageService
            .setup(ls => ls.getLatestNugetPackageVersion())
            .returns(() => Promise.resolve(pkgInfo))
            .verifiable(typeMoq.Times.atLeastOnce());
        serviceContainer
            .setup(c => c.get(typeMoq.It.isValue(ILanguageServerPackageService)))
            .returns(() => lsPackageService.object);

        await lsFolderService.getLatestLanguageServerVersion();

        lsPackageService.verifyAll();
    });
    test('Get folder version', async () => {
        const version = lsFolderService.getFolderVersion(`${languageServerFolder}.${'1.2.3'}`);
        expect(version.raw).to.equal('1.2.3');
    });
    test('Get existing language server directories', async () => {
        const root = path.join('users', 'vsc', 'extensions', 'ms-python.2018.xyz');
        const folders = ['one', `${languageServerFolder}.0.0.1`, `${languageServerFolder}.2.0.1`, `${languageServerFolder}.3.9.1`, 'two'];
        const expectedFolders = folders.filter(f => f.startsWith('languageServer'));
        const fs = typeMoq.Mock.ofType<IFileSystem>();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IFileSystem))).returns(() => fs.object);
        fs
            .setup(f => f.getSubDirectories(typeMoq.It.isValue(EXTENSION_ROOT_DIR)))
            .returns(() => Promise.resolve(folders.map(dirName => path.join(root, dirName))))
            .verifiable(typeMoq.Times.once());

        const existingDirs = await lsFolderService.getExistingLanguageServerDirectories();

        expect(existingDirs).to.be.lengthOf(expectedFolders.length);
        expect(existingDirs.map(f => f.path)).to.be.deep.equal(expectedFolders.map(dirName => path.join(root, dirName)));
        expect(existingDirs.map(f => f.version.raw)).to.be.deep.equal(['0.0.1', '2.0.1', '3.9.1']);
    });
    test('Get latest language server directory', async () => {
        const root = path.join('users', 'vsc', 'extensions', 'ms-python.2018.xyz');
        const folders = [`${languageServerFolder}.0.0.1`, `${languageServerFolder}.2.0.1`, `${languageServerFolder}.3.9.1`, `${languageServerFolder}.1.9.1`];
        const expectedFolders = folders.map(f => {
            return {
                path: path.join(root, f),
                version: parse(path.basename(f).substring(languageServerFolder.length + 1), true)
            };
        });
        lsFolderService.getExistingLanguageServerDirectories = () => Promise.resolve(expectedFolders as any);

        const latestFolder = await lsFolderService.getCurrentLanguageServerDirectory();

        expect(latestFolder!.path).to.be.equal(path.join(root, 'languageServer.3.9.1'));
        expect(latestFolder!.version.raw).to.be.equal('3.9.1');
    });
    test('Get latest language server folder name from nuget package version when there is no local folder', async () => {
        const pkg: NugetPackage = { package: 'abc', version: new SemVer('1.1.1'), uri: 'xyz' };
        settings.setup(s => s.autoUpdateLanguageServer).returns(() => true).verifiable(typeMoq.Times.once());
        lsFolderService.getCurrentLanguageServerDirectory = () => Promise.resolve(undefined);
        lsFolderService.getLatestLanguageServerVersion = () => Promise.resolve(pkg);

        const folderName = await lsFolderService.getLanguageServerFolderName();

        expect(folderName).to.be.equal(`${languageServerFolder}.${pkg.version.raw}`);
    });
    test('Get latest language server folder name when local is same as nuget package version', async () => {
        const pkg: NugetPackage = { package: 'abc', version: new SemVer('1.1.1'), uri: 'xyz' };
        const existingFolder = { path: path.join('1', '2', 'abc'), version: new SemVer('1.1.1') };
        settings.setup(s => s.autoUpdateLanguageServer).returns(() => true).verifiable(typeMoq.Times.once());
        lsFolderService.getCurrentLanguageServerDirectory = () => Promise.resolve(existingFolder);
        lsFolderService.getLatestLanguageServerVersion = () => Promise.resolve(pkg);

        const folderName = await lsFolderService.getLanguageServerFolderName();

        settings.verifyAll();
        expect(folderName).to.be.equal('abc');
    });
    test('Get latest language server folder name when remote version is greater', async () => {
        const pkg: NugetPackage = { package: 'abc', version: new SemVer('2.1.1'), uri: 'xyz' };
        const existingFolder = { path: path.join('1', '2', 'abc'), version: new SemVer('1.1.1') };
        settings.setup(s => s.autoUpdateLanguageServer).returns(() => true).verifiable(typeMoq.Times.once());
        lsFolderService.getCurrentLanguageServerDirectory = () => Promise.resolve(existingFolder);
        lsFolderService.getLatestLanguageServerVersion = () => Promise.resolve(pkg);

        const folderName = await lsFolderService.getLanguageServerFolderName();

        settings.verifyAll();
        expect(folderName).to.be.equal(`${languageServerFolder}.2.1.1`);
    });
    test('Get local folder name when remote version is greater and auto download is disabled', async () => {
        const pkg: NugetPackage = { package: 'abc', version: new SemVer('2.1.1'), uri: 'xyz' };
        const existingFolder = { path: path.join('1', '2', 'abc'), version: new SemVer('1.1.1') };
        settings.setup(s => s.autoUpdateLanguageServer).returns(() => false).verifiable(typeMoq.Times.once());
        lsFolderService.getCurrentLanguageServerDirectory = () => Promise.resolve(existingFolder);
        lsFolderService.getLatestLanguageServerVersion = () => Promise.resolve(pkg);

        const folderName = await lsFolderService.getLanguageServerFolderName();

        settings.verifyAll();
        expect(folderName).to.be.equal('abc');
    });
});
